const rabbit = require('amqplib');


(async function main() {
    console.info('\n setup\n');
    const connection = rabbit.connect('amqp://guest:guest@localhost');

    connection.then(async (conn) => {
        const channel = await conn.createChannel();
        //await channel.assertExchange('main', 'direct');
        await channel.assertQueue('test.queue', {
            deadLetterRoutingKey: 'test.queue.expired',
            deadLetterExchange: 'test.direct',
            messageTtl: 15000,
            durable: true
        });

        //channel.bindQueue('test.queue', 'main', 'key.test');
        channel.consume('test.queue', (message) => {
            //console.log(message);

            let str = message.content.toString('utf-8');
            let obj = toObject(str)
            console.log(obj)

            if (obj) {
                console.log(obj["test"])
            }
            
            const correlationId = message.properties.correlationId;
            const replyTo = message.properties.replyTo;

            const toReturn = {
                "proccessed": true
            }

            const messageToReturn = JSON.stringify(toReturn);

            setTimeout(function () {
                console.log(`Returning message... to ${replyTo} and ${correlationId}`)
                channel.sendToQueue(replyTo, Buffer.from(messageToReturn), {
                    correlationId: correlationId
                });        
            }, 10000);

            
            channel.ack(message);
        });
    });
})().catch(console.error.bind(console, 'General error:'));

function toObject(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        console.log("trying to convert message")
        str = `"${str}"`
        console.log(str)
        try {
            let obj = JSON.parse(str);
            obj = JSON.parse(obj)
            return obj
        } catch (e) {
            console.error(e.message, 2);
            return null
        }
    }
}
