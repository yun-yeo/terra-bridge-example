import BN from 'bn.js';

export class Coin {
    amount: BN;
    denom: string;

    constructor(denom: string, amount: string) {
        this.amount = new BN(amount);
        this.denom = denom;
    }
}