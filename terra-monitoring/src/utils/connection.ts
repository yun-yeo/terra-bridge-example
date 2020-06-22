import request from 'request-promise';

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
    network: NetworkInfo;
    targetAddr: string;

    constructor() {
        const network: NetworkInfo = NETWORKS[process.env.NETWORK];
        if (!network) {
            console.error('Failed to fetch network info');
            process.exit(-1);
        }

        this.network = network;
        this.targetAddr = process.env.TARGET_ADDRESS;
    }

    async loadTxs(page: number, limit: number) {
        return await request.get(`${this.network.url}/v1/txs?account=${this.targetAddr}&order=ASC&page=${page}&chainId=${this.network.chainID}`);
    }
}