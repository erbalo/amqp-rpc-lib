## How to run the examples

1. Install the dependencies

```shell
$ npm install
```

2. Build the project to compile TS to JS files

```shell
$ npm run prepare
```

3. Go to the examples folder

```shell
$ cd examples
```

4. Start the rabbitmq with docker-compose

```shell
$ docker-compose up
```

5. Initialize the server

```shell
$ node server.js
```

6. Runs a client

```shell
$ node client.js
```

> Note: If you are doing some changes on the source code, you need to re-compile

```shell
$ npm run build:clean
```

and go the the step 1. again

```shell
$ npm run prepare
```


