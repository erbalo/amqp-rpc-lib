const rabbit = require('amqplib');
const { v4: uuidv4 } = require('uuid');

(async function main() {
    console.info('\n setup\n');
    const connection = rabbit.connect('amqp://guest:guest@localhost');

    connection.then(async (conn) => {
        const channel = await conn.createChannel();
        await channel.assertExchange('main', 'direct');
        const queue = await channel.assertQueue('', {
            exclusive: true,
            messageTtl: 5000
        });

        const message = {
            "test": "Frommm this"
        }

        const correlationId = uuidv4()
        const json = JSON.stringify(message)

        console.log("Correlation id", correlationId);
        console.log("Queue", queue.queue);

        channel.consume(queue.queue, (message) => {
            if (message.properties.correlationId = correlationId) {
                console.log("Got", message.content.toString())
                setTimeout(function () {
                    conn.close();
                }, 10000);
            }
        }, { noAck: true })


        channel.sendToQueue('test.queue', Buffer.from(json), {
            correlationId: correlationId,
            replyTo: queue.queue
        });
    });
})().catch(console.error.bind(console, 'General error:'));