const Command = require('./command');
const CommandResult = require('./command-result');
const AmqpEndpoint = require('./amq-endpoint');

/**
 * Implementation for an AMQP RPC producer.
 *
 * @class
 */
class AmqpRpcProducer extends AmqpEndpoint {
    /**
     * Creates a new instance of RPC producer.
     *
     * @param {*} connection Connection reference created from `amqplib` library
     *
     * @param {Object} params
     * @param {String} params.requestsQueue queue when AMQPRPC client sends commands, should correspond with AMQPRPCClient
     *    default is '' which means auto-generated queue name
     */
    constructor(connection, params = {}) {
        params.requestsQueue = params.requestsQueue || '';

        super(connection, params);

        this._requestsQueue = params.requestsQueue;
        this._commands = {};
        this._cb = null;
    }

    /**
     * Initialize RPC producer.
     *
     * @returns {Promise}
     * @override
     */
    async start() {
        await super.start();

        if (this._requestsQueue === '') {
            const response = await this._channel.assertQueue('', { exclusive: true });
            this._requestsQueue = response.queue;
        }

        const consumeResult = await this._channel.consume(this._requestsQueue, (msg) => this._handleMsg(msg));
        //this._consumerTag = consumeResult.consumerTag
    }

    /**
     * Opposite to this.start()
     *
     * @returns {Promise}
     */
    async disconnect() {
        //await this._channel.cancel(this._consumerTag);

        if (this._params.requestsQueue === '') {
            await this._channel.deleteQueue(this._requestsQueue);
            this._requestsQueue = '';
        }

        await super.disconnect();
    }

    registerListener(cb) {
        this._cb = cb;

        return this;
    }

    /**
     *
     * @private
     */
    async _handleMsg(msg) {

        this._channel.ack(msg);
        const replyTo = msg.properties.replyTo;
        const correlationId = msg.properties.correlationId;
        const persistent = msg.properties.deliveryMode !== 1;

        try {
            const result = await this._dispatchCommand(msg);

            const content = new CommandResult(CommandResult.STATES.SUCCESS, result).pack();
            this._channel.sendToQueue(replyTo, content, { correlationId, persistent });

        } catch (error) {
            const content = new CommandResult(CommandResult.STATES.ERROR, error).pack();
            this._channel.sendToQueue(replyTo, content, { correlationId, persistent });
        }
    }

    /**
     * Dispatches a command with specified message.
     *
     * @private
     * @param {Object} msg
     */
    _dispatchCommand(msg) {
        const command = Command.fromBuffer(msg.content);
        /*if (this._commands[command.command] && this._commands[command.command] instanceof Function) {
            return this._commands[command.command].apply(null, [command.args]);
        }*/
        if (this._cb && this._cb instanceof Function) {
            return this._cb.apply(null, [command.args])
        }

        throw new Error(`Unknown command ${command.command}`);
    }

    /**
     * Allows to get generated value when params.requestsQueue was set to '' (empty string) or omitted
     * @returns {String} an actual name of the queue used by the instance for receiving replies
     */
    get requestsQueue() {
        return this._requestsQueue;
    }
}

module.exports = AmqpRpcProducer;