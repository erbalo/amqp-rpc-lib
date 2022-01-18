/* eslint-disable no-console  */
/* eslint-disable import/no-extraneous-dependencies */

const amqplib = require('amqplib')
const AmqpRpcProducer = require('../src/amq-rpc-producer')
const { v4: uuidv4 } = require('uuid');

/**
 *
 * @return {Promise<String>} queueName when server listens on for requests
 */
async function initialSetup(queueName) {
    const connection = await amqplib.connect('amqp://localhost');
    const channel = await connection.createChannel();
    await channel.assertQueue(queueName, {
        deadLetterRoutingKey: queueName + '.expired',
        deadLetterExchange: queueName + '.direct',
        messageTtl: 15000,
        durable: true
    });
}

function delay(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    })
}

/**
 *
 * @param requestsQueue
 * @return {Promise<void>}
 */
async function initServer(requestsQueue) {
    console.log('Server starting');
    const connection = await amqplib.connect('amqp://localhost');
    const server = new AmqpRpcProducer(connection, { requestsQueue });

    server.registerListener(async (obj) => {
        console.log("Request to process:", obj);

        if(obj.name === 'erick'){
            return {
                status_code: 404,
                message: "not found custom message"
            }
        }

        return {
            status_code: 201,
            message: "User created",
            data: {                
                id: uuidv4(),
                created_at: Date.now(),
            }
        }
    });

    await server.start();
    console.log('Server is ready');
}


(async function main() {
    console.info('\n setup\n');
    const queueName = 'edu.api.user.service.create';
    await initialSetup(queueName);

    console.info('\n launch server:\n');
    await initServer(queueName)
})().catch(console.error.bind(console, 'General error:'));