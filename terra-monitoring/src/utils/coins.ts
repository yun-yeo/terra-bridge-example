import BN from 'bn.js';
import { Coin } from './coin';

export class Coins {
    coins: Coin[];
    constructor(coins: { denom: string, amount: string }[]) {
        this.coins = [];

        coins.forEach(c => {
            this.coins.push(new Coin(c.denom, c.amount));
        });
    }

    amountOf(denom: string): BN {
        for (const coin of this.coins) {
            if (coin.denom === denom) {
                return coin.amount;
            }
        }

        return new BN(0);
    }
}
