import {
    Account,
    AccAddress,
    LCDClient,
    LazyGradedVestingAccount,
    MnemonicKey,
    TxInfo,
    Coins,
    Coin,
    MsgSend,
    StdFee,
    StdSignMsg,
} from '@terra-money/terra.js';

interface NetworkInfo {
    url: string;
    chainID: string;
}

const NETWORKS = {
    mainnet: {
        url: 'https://fcd.terra.dev',
        chainID: 'columbus-3',
    },
    soju: {
        url: 'https://soju-fcd.terra.dev',
        chainID: 'soju-0014',
    },
    vodka: {
        url: 'https://vodka-fcd.terra.dev',
        chainID: 'soju-0014',
    },
    localnet: {
        url: 'http://127.0.0.1:1317',
        chainID: 'localnet',
    }
};

export class Conn {
    lcdClient: LCDClient;
    key: MnemonicKey;
    fee: StdFee;
    accNumber: number;
    sequenceNum: number;
    chainID: string;

    constructor() {
        const network: NetworkInfo = NETWORKS[process.env.NETWORK];
        if (!network) {
            console.error('Failed to fetch network info');
            process.exit(-1);
        }

        this.chainID = network.chainID;
        this.lcdClient = new LCDClient({
            URL: network.url,
            chainID: network.chainID,
        });


        this.key = new MnemonicKey({ mnemonic: process.env.WORKER_SEED });
        this.fee = new StdFee(100000, new Coins([new Coin(process.env.FEE_DENOM, 1500)]));
        this.chainID = network.chainID;
        this.accNumber = 0;
        this.sequenceNum = 0;
    }

    /**
     * @return [accountNumber: number, sequenceNumber: number]
     */
    async loadAccountInfo(): Promise<[number, number]> {
        const accInfo = await this.lcdClient.auth.accountInfo(this.key.accAddress);
        let chainSequenceNum = 0;
        let accNumber = 0;

        if (accInfo instanceof Account) {
            chainSequenceNum = accInfo.sequence;
            accNumber = accInfo.account_number;
        } else if (accInfo instanceof LazyGradedVestingAccount) {
            chainSequenceNum = accInfo.BaseAccount.sequence;
            accNumber = accInfo.BaseAccount.account_number;
        }

        return [accNumber, chainSequenceNum];
    }

    async checkTx(txhash: string): Promise<TxInfo> {
        return await this.lcdClient.tx.txInfo(txhash);
    }

    async sendTx(toAddress: AccAddress, coins: Coins, memo: string):Promise<void> {
        if (this.accNumber === 0) {
            const [accNumber, sequenceNum] = await this.loadAccountInfo();
            this.sequenceNum = sequenceNum;
            this.accNumber = accNumber;
        }

        const msgs = [new MsgSend(this.key.accAddress, toAddress, coins)];
        const signMsg = new StdSignMsg(this.chainID, this.accNumber, this.sequenceNum, this.fee, msgs, memo);
        const signedTx = this.key.signTx(signMsg);
        const res = await this.lcdClient.tx.broadcastSync(signedTx);
        const log = JSON.parse(res.raw_log);

        if (log['code']) throw log['message'];

        this.sequenceNum++;
        return;
    }
}
