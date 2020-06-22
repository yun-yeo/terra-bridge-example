import { Conn } from '../utils/connection';
import { delay } from 'bluebird';
import dotenv from 'dotenv';
import { promisify } from 'util';
import { createClient } from 'redis';
import { Coins } from '../utils/coins';
import BN from 'bn.js';
dotenv.config();

const redisClient = createClient({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    prefix: process.env.REDIS_PREFIX,
});

const redisGet = promisify(redisClient.get).bind(redisClient);
const redisQuit = promisify(redisClient.quit).bind(redisClient);

const TARGET_ADDRESS = process.env.TARGET_ADDRESS;
const TARGET_DENOM = process.env.TARGET_DENOM;
const LOAD_UNIT = 10;

const TARGET_PAGE_KEY = 'target_page';
const TARGET_INDEX_KEY = 'target_index';
const QUEUE_NAME = process.env.REDIS_QUENE_NAME;
interface MonitoringMsg {
    tx_hash: string;
    from_addr: string;
    to_addr: string;
    amount: string;
}

let run = true;
async function main() {
    const conn = new Conn();

    let targetPage = await redisGet(TARGET_PAGE_KEY);
    if (targetPage == null) {
        targetPage = 1;
    } else {
        targetPage = Number(targetPage);
    }

    let targetIndex = await redisGet(TARGET_INDEX_KEY);
    if (targetIndex == null) {
        targetIndex = 0;
    } else {
        targetIndex = Number(targetIndex);
    }

    try {
        while (run) {
            const queueMsgs: string[] = [];

            console.log('Loading Txs...');
            const res = JSON.parse(await conn.loadTxs(targetPage, LOAD_UNIT));
            const txs = res['txs'];

            for (let idx = targetIndex; idx < txs.length; idx++) {
                const tx = txs[idx]['tx'];
                const txHash = txs[idx]['txhash'];
                const msg = tx['value']['msg'][0];
                const toAddr = tx['value']['memo'];

                if (msg['type'] === 'bank/MsgSend' &&
                    msg['value']['to_address'] === TARGET_ADDRESS) {
                    const fromAddr = msg['value']['from_address'];
                    const coins = new Coins(msg['value']['amount'] || []);
                    const amount = coins.amountOf(TARGET_DENOM);

                    if (amount.lte(new BN(0))) continue;

                    const queueMsg: MonitoringMsg = {
                        tx_hash: txHash,
                        amount: amount.toString(),
                        from_addr: fromAddr,
                        to_addr: toAddr
                    };

                    queueMsgs.push(JSON.stringify(queueMsg));
                    console.log(`=======================\n${txHash}:\n${fromAddr} sends ${amount.toString()} UST\nto request deposit to ${toAddr}\n=======================`);
                }
            }

            // Check there are new txs with target index
            if (targetIndex < txs.length) {
                targetIndex = txs.length;
                if (targetIndex === LOAD_UNIT) {
                    targetPage++;
                    targetIndex = 0;
                }

                await new Promise((resolve, reject) => {
                    let redisTx = redisClient.multi();
                    queueMsgs.forEach(msg => {
                        redisTx = redisTx.rpush(QUEUE_NAME, msg);
                    });

                    redisTx
                        .set(TARGET_PAGE_KEY, targetPage)
                        .set(TARGET_INDEX_KEY, targetIndex)
                        .exec(err => {
                            if (err) reject(err);
                            else resolve();
                        });
                });
            }

            const totalCnt = res['totalCnt'];
            const totalCheckedCnt = (targetPage - 1) * LOAD_UNIT + targetIndex;
            console.log(`Total Tx Count: ${totalCnt}\nTotal Check Tx Count: ${totalCheckedCnt}\n`);
            if (totalCnt === totalCheckedCnt) {
                await delay(5000);
            }
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
