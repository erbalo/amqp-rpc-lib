/* eslint-disable no-console  */
/* eslint-disable import/no-extraneous-dependencies */

const amqplib = require('amqplib')
const AmpqRpcConsumer = require('../src/amq-rpc-consumer')

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
async function initClient1(requestsQueue) {
    console.log('Tom starting');
    const connection = await amqplib.connect('amqp://localhost');
    const client = new AmpqRpcConsumer(connection, {
        requestsQueue,
        timeout: 15000
    });

    await client.start();
    console.log("Ready")

    try {
        const response1 = await client.sendAndReceive([1, 2, 3]);
        console.log("Getting response", response1)
    } catch (e) {
        console.error("Error where?", e)
        return false;
    }

    await delay(100);

    return true;
}

(async function main() {
    console.info('\n setup\n');
    const queueName = 'edu.api.user.service.create';

    console.info('\n launch clients:\n');

    try {
        let [cli1] = await Promise.all([
            initClient1(queueName),
        ]);

        if (cli1) {
            await delay(3000)
            console.log(cli1);
            process.exit(0);
        } else {
            await delay(1000);
            console.log("Exiting with..", cli1);
            process.exit(0)
        }

    } catch (e) {
        console.error("Another kind of error", e);
    }
})().catch(console.error.bind(console, 'General error:'));