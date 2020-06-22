import { PublicKey, Coins, Coin } from '@terra-money/terra.js';
import { Conn } from '../utils/connection';
import { delay } from 'bluebird';
import dotenv from 'dotenv';
import { promisify } from 'util';
import { createClient } from 'redis';
dotenv.config();

const redisClient = createClient({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    prefix: process.env.REDIS_PREFIX,
});

const redisLRange = promisify(redisClient.lrange).bind(redisClient);
const redisLPop = promisify(redisClient.lpop).bind(redisClient);
const redisQuit = promisify(redisClient.quit).bind(redisClient);

const QUEUE_NAME = process.env.REDIS_QUENE_NAME;
const TARGET_DENOM = process.env.TARGET_DENOM;
interface MonitoringMsg {
    tx_hash: string;
    from_addr: string;
    to_addr: string;
    amount: string;
}

let run = true;
async function main() {
    const conn = new Conn();
    try {
        while (run) {
            const receiveRes = await redisLRange(QUEUE_NAME, 0, 0);
            if (receiveRes.length === 0) {
                await delay(500);
                continue;
            }

            const msg: MonitoringMsg = JSON.parse(receiveRes);
            const destAddr = msg.to_addr;
            const amount = msg.amount;
            const denom = TARGET_DENOM;
            const coins = new Coins([new Coin(denom, amount)]);
            await conn.sendTx(destAddr, coins, 'Sent from Terra bridge');
            console.log(`==============\nsend ${amount} ${denom} to\n${destAddr}\n==============`);

            await redisLPop(QUEUE_NAME);
        }
    } catch (err) {
        // TODO - Send Notification
        console.error(err);
        await redisQuit();
    }
}

const mainProgram = main().catch(err => {
    console.error(err);
});

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

async function cleanup() {
    run = false;
    await mainProgram;
    await redisQuit();
}