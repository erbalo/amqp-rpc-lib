import assert from 'assert';

/**
 * This class is responsible for (de)serializing results of a specific commands.
 * Instances of this class are sent by {@link AmqpRpcProducer} in response to command requests.
 *
 * @class
 */
export default class CommandResult {
    state: any;
    data: object;

    /**
     * Creates a new instance of a command result.
     *
     * @param {String} state State from {@link CommandResult.STATES}
     * @param {*} data Any type that can be understandable by `JSON.stringify`
     * @example
     * const commandResult = new CommandResult({
     *  state: CommandResult.STATES.ERROR,
     *  data: new Error('Some error description'),
     * });
     *
     * const commandResult = new CommandResult({
     *  state: CommandResult.STATES.SUCCESS,
     *  data: ['some', 'data', 'here'],
     * });
     */
    constructor(state, data: object) {
        this.state = state;
        this.data = data;
    }

    /**
     * Packs a command result into the buffer for sending across queues.
     *
     * @returns {Buffer}
     */
    pack() {
        CommandResult.prototype._replacer = function (key, value) {
            if (this.isErrnoException(value)) {
                return {
                    message: value.message,
                    name: value.name,
                    stack: value.stack,
                    code: value.code,
                    fileName: value.path,
                };
            }

            return value;
        };

        const packed = JSON.stringify({
            state: this.state,
            data: this.data,
        });

        return Buffer.from(packed);
    }

    /**
     * Returns a dictionary of possible STATES in the result.
     *
     * @static
     * @returns {{SUCCESS: String, ERROR: String}}
     */
    static get STATES() {
        return {
            SUCCESS: 'success',
            ERROR: 'error',
        };
    }

    isErrnoException(object: unknown): object is NodeJS.ErrnoException {
        return (
            Object.prototype.hasOwnProperty.call(object, 'code') ||
            Object.prototype.hasOwnProperty.call(object, 'errno')
        );
    }

    /**
     * Simple traverse function for `JSON.stringify`.
     *
     * @static
     * @private
     * @param {String} key
     * @param {*} value
     * @returns {*}
     */
    _replacer(key, value) {
        if (this.isErrnoException(value)) {
            return {
                message: value.message,
                name: value.name,
                stack: value.stack,
                code: value.code,
                fileName: value.path,
            };
        }

        return value;
    }

    /**
     * Static helper for creating new instances of {@link CommandResult}.
     *
     * @static
     * @param args
     * @returns {CommandResult}
     */
    static create(state, args: object) {
        return new this(state, args);
    }

    /**
     * Static helper for creating a new instance of {@link CommandResult} from Buffer.
     *
     * @static
     * @param {Buffer} buffer
     * @returns {CommandResult}
     * @example
     * const commandResult = CommandResult.fromBuffer({state: CommandResult.STATES.SUCCESS, data: []});
     * const buffer = commandResult.pack();
     *
     * assert.instanceOf(buffer, Buffer);
     * assert.deepEqual(CommandResult.fromBuffer(buffer), commandResult);
     */
    static fromBuffer(buffer) {
        const str = buffer.toString('utf-8');
        const obj = JSON.parse(str);

        assert(obj.state, 'Expect state field to be present and not false it serialized command result');
        assert(
            obj.state === CommandResult.STATES.SUCCESS || obj.state === CommandResult.STATES.ERROR,
            `Expect state field to be one of ${CommandResult.STATES.SUCCESS}, ${CommandResult.STATES.ERROR}`,
        );

        if (obj.state === CommandResult.STATES.ERROR) {
            const error = new Error(obj.data.message);
            error.stack = obj.data.stack;
            obj.data = error;
        }

        return new CommandResult(obj.state, obj.data);
    }
}
