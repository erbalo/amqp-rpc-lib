import { v4 as uuidv4 } from 'uuid';
import Command from './command';
import CommandResult from './command-result';
import AmqpEndpoint from './amq-endpoint';

export interface AmqpConsumerParamOptions {
    repliesQueue?: string;
    requestsQueue?: string;
    timeout?: number;
    [key: string]: any;
}

/**
 * This class is responsible for sending commands to the RPC server.
 *
 * @class
 */
export default class AmpqRpcConsumer extends AmqpEndpoint {
    _repliesQueue: any;
    _requests: any;
    _defaultMessageOptions: any;

    /**
     * Creates a new instance of an RPC consumer.
     *
     * @param {*} connection Instance of `amqplib` library
     *
     * @param {Object} params
     * @param {String} params.requestsQueue queue for sending commands, should correspond with AMQPRPCServer
     * @param {String} [params.repliesQueue=''] queue for feedback from AMQPRPCServer,
     *    default is '' which means auto-generated queue name
     * @param {Number} [params.timeout=60000] Timeout for cases when server is not responding
     * @param {Object} [params.defaultMessageOptions] additional options for publishing the request to the queue
     */
    constructor(connection, params: AmqpConsumerParamOptions) {
        params.repliesQueue = params.repliesQueue || '';
        params.timeout = params.timeout || AmpqRpcConsumer.TIMEOUT;

        if (!params.requestsQueue) {
            throw new Error('params.requestsQueue is required');
        }
        super(connection, params);

        this._repliesQueue = params.repliesQueue;
        this._requests = new Map();
        this._defaultMessageOptions = params.defaultMessageOptions || {};
    }

    /**
     * Send a command into RPC queue.
     *
     * @param {String} command Command name
     * @param [Array<*>] args Array of any arguments provided to the RPC server callback
     * @param [Object] messageOptions options for publishing the request to the queue
     * @returns {Promise<*>}
     * @example
     * client.sendAndReceive({foo: 'bar'});
     */
    async sendAndReceive(args, messageOptions: { [key: string]: any }) {
        const command = 'command-execution';
        const cmd = new Command(command, args);
        let correlationId = uuidv4();

        if (messageOptions && messageOptions.correlationId) {
            correlationId = messageOptions.correlationId;
        }

        if (messageOptions && messageOptions.correlation_id) {
            correlationId = messageOptions.correlation_id;
        }

        const replyTo = this._repliesQueue;
        const timeout = this._params.timeout;
        const requestsQueue = this._params.requestsQueue;
        const commonProperties = { replyTo, correlationId };

        const properties = Object.assign({}, messageOptions, this._defaultMessageOptions, commonProperties);

        let resolve;
        let reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });

        const timer = setTimeout(() => this._cancel(correlationId, `timeout (${timeout})`), timeout);
        this._requests.set(correlationId, {
            timer,
            resolve,
            reject,
            command,
        });

        this._channel.sendToQueue(requestsQueue, cmd.pack(), properties);

        return promise;
    }

    /**
     * Initialize RPC consumer.
     *
     * @returns {Promise}
     * @override
     */
    async start() {
        await super.start();
        if (this._params.repliesQueue === '') {
            const response = await this._channel.assertQueue('', { exclusive: true });
            this._repliesQueue = response.queue;
        }

        const consumeResult = await this._channel.consume(this._repliesQueue, (msg) => this._dispatchReply(msg));
        // this._consumerTag = consumeResult.consumerTag
    }

    /**
     * Opposite to this.start()
     *
     * @returns {Promise}
     */
    async disconnect() {
        // await this._channel.cancel(this._consumerTag);

        if (this._params.repliesQueue === '') {
            await this._channel.deleteQueue(this._repliesQueue);
            this._repliesQueue = '';
        }

        this._requests.forEach((context, correlationId) => this._cancel(correlationId, 'client disconnect'));
        await super.disconnect();
    }

    /**
     * Replies handler
     * @param {Object} msg, returned by channel.consume
     * @private
     * @returns {Promise}
     */
    async _dispatchReply(msg) {
        this._channel.ack(msg);
        if (!msg) {
            // skip, it's queue close message
            return;
        }

        const correlationId = msg.properties.correlationId;
        const context = this._requests.get(correlationId);
        this._requests.delete(correlationId);
        if (!context) {
            // it would be good to notice somehow, but we don't have logger or something here at all
            return;
        }

        const { resolve, timer, reject } = context;
        clearTimeout(timer);

        try {
            const response = CommandResult.fromBuffer(msg.content);

            if (response.state === CommandResult.STATES.ERROR) {
                reject(response.data);
            } else {
                resolve(response.data);
            }
        } catch (e) {
            reject(e);
        }
    }

    _cancel(correlationId, reason) {
        const context = this._requests.get(correlationId);
        const { timer, reject, command } = context;
        clearTimeout(timer);
        this._requests.delete(correlationId);
        reject(new Error(`sendCommand canceled due to ${reason}, command:${command}, correlationId:${correlationId}`));
    }

    /**
     * Returns a timeout for a command result retrieval.
     *
     * @static
     * @returns {Number}
     */
    static get TIMEOUT(): number {
        return 60 * 1000;
    }

    /**
     * Allows to get generated value when params.repliesQueue was set to '' (empty string) or omitted
     * @returns {String} an actual name of the queue used by the instance for receiving replies
     */
    get repliesQueue(): string {
        return this._repliesQueue;
    }
}
