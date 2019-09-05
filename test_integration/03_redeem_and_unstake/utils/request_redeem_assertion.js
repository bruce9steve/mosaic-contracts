// Copyright 2019 OpenST Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// ----------------------------------------------------------------------------
//
// http://www.simpletoken.org/
//
// ----------------------------------------------------------------------------

const assert = require('assert');
const BN = require('bn.js');

/**
 * Redeem Request object contains all the properties for redeem and unstake.
 * @typedef {Object} RedeemRequest
 * @property {BN} amount Redeem amount.
 * @property {BN} gasPrice Gas price that Redeemer is ready to pay to get the
 *                         redeem and unstake process done.
 * @property {BN} gasLimit Gas limit that redeemer is ready to pay.
 * @property {string} redeemer Address of Redeemer.
 * @property {BN} bounty Bounty amount paid for redeem and unstake message
 *                       transfers.
 * @property {BN} nonce Redeem nonce.
 * @property {string} beneficiary Address of beneficiary on origin chain.
 * @property {string} hashLock Hash Lock provided by the redeemer.
 * @property {string} unlockSecret Unlock secret to unlock hash lock.
 * @property {string} messageHash Identifier for redeem and unstake process.
 * @property {BN} blockHeight Height at which anchor state root is done.
 */

/**
 * BaseToken(ETH) and OSTPrime ERC20 balance of cogateway, redeemer.
 * @typedef {Object} Balances
 * @property {BN} balances.ostPrime.redeemPool ERC20 balance of redeemPool
 * contract.
 * @property {BN} balances.ostPrime.redeemer ERC20 balance of beneficiary.
 * @property {BN} balances.baseToken.redeemPool Base token(ETH) balance of
 * redeem composer.
 * @property {BN} balances.baseToken.redeemer Base token(ETH) balance of redeemer.
 */

/**
 * Class to assert event and balances after request Redeem.
 */
class RequestRedeemAssertion {
  /**
     * Constructor.
     * @param {Object} redeemPool Truffle redeemPool instance.
     * @param {Object} ostPrime Truffle token instance.
     * @param {Web3} web3 Web3 instance.
     */
  constructor(redeemPool, ostPrime, web3) {
    this.redeemPool = redeemPool;
    this.token = ostPrime;
    this.web3 = web3;
  }

  /**
     * This verifies event and balances.
     * @param {Object} event Event object after decoding.
     * @param redeemRequest Redeem request parameters.
     * @param {BN} transactionFees Transaction fees in redeem request.
     * @param {Balances} initialBalances Initial baseToken and token balances.
     */
  async verify(event, redeemRequest, transactionFees, initialBalances) {
    await this._assertBalancesForRequestRedeem(
      redeemRequest,
      initialBalances,
      transactionFees,
    );

    RequestRedeemAssertion._assertRequestRedeemEvent(event, redeemRequest);
  }

  /**
     * This captures base token and token balance of cogateway and redeemer
     * @param {string} redeemer Redeemer address.
     * @return {Promise<Balances>}
     */
  async captureBalances(redeemer) {
    return {
      baseToken: {
        redeemPool: await this._getEthBalance(this.redeemPool.address),
        redeemer: await this._getEthBalance(redeemer),
      },
      token: {
        redeemPool: await this.token.balanceOf(this.redeemPool.address),
        redeemer: await this.token.balanceOf(redeemer),
      },
    };
  }

  /**
     * This asserts balances of redeemer and cogateway after Redeem.
     * @param {RedeemRequest} redeemRequest Redeem request parameters.
     * @param {Balances} initialBalances Initial balance of redeemer and cogateway
     *                                   generated by captureBalances method.
     * @param {BN} transactionFees Transaction fees in redeem request.
     * @private
     */
  async _assertBalancesForRequestRedeem(redeemRequest, initialBalances, transactionFees) {
    const finalBalances = await this.captureBalances(redeemRequest.redeemer);

    // Assert redeem composer balance.
    const expectedRedeemPoolBaseTokenBalance = initialBalances.baseToken.redeemPool;

    // Assert no change in redeem composer balance.
    assert.strictEqual(
      expectedRedeemPoolBaseTokenBalance.eq(finalBalances.baseToken.redeemPool),
      true,
      `Redeem composer base token balance must be ${expectedRedeemPoolBaseTokenBalance.toString(10)}`
           + ` instead of ${finalBalances.baseToken.redeemPool.toString(10)}`,
    );

    const expectedRedeemPoolTokenBalance = initialBalances.token.redeemPool
      .add(redeemRequest.amount);

    // Assert Redeem amount is transferred to RedeemPool.
    assert.strictEqual(
      expectedRedeemPoolTokenBalance.eq(finalBalances.token.redeemPool),
      true,
      `RedeemPool token balance must be ${expectedRedeemPoolBaseTokenBalance.toString(10)}`
           + ` instead of ${finalBalances.token.redeemPool.toString(10)}`,
    );

    // Assert redeemer balance.
    const expectedRedeemerBaseTokenBalance = initialBalances.baseToken.redeemer
      .sub(transactionFees);

    // Assert only transaction fee is deducted.
    assert.strictEqual(
      expectedRedeemerBaseTokenBalance.eq(finalBalances.baseToken.redeemer),
      true,
      `Redeemer base token balance must be ${expectedRedeemerBaseTokenBalance.toString(10)}`
           + ` instead of ${finalBalances.baseToken.redeemer.toString(10)}`,
    );

    const expectedRedeemerTokenBalance = initialBalances.token.redeemer
      .sub(redeemRequest.amount);

    // Assert Redeem amount is transferred from redeemer.
    assert.strictEqual(
      expectedRedeemerTokenBalance.eq(finalBalances.token.redeemer),
      true,
      `Redeemer token balance must be ${expectedRedeemerTokenBalance.toString(10)}`
           + ` instead of ${finalBalances.token.redeemer.toString(10)}`,
    );
  }

  /**
     * This asserts event after Redeem method.
     * @param {Object} event Event object after decoding.
     * @param {RedeemRequest} redeemRequest Redeem request parameters.
     * @private
     */
  static _assertRequestRedeemEvent(event, redeemRequest) {
    const eventData = event.RedeemRequested;

    assert.strictEqual(
      eventData.redeemer,
      redeemRequest.redeemer,
      `Redeemer address from event ${eventData._redeemer} must be equal to ${redeemRequest.redeemer}.`,
    );

    assert.strictEqual(
      redeemRequest.nonce.eq(eventData.nonce),
      true,
      `Redeemer nonce from event ${eventData._redeemerNonce} 
            must be equal to ${redeemRequest.nonce.toString(10)}.`,
    );

    assert.strictEqual(
      eventData.beneficiary,
      redeemRequest.beneficiary,
      `Beneficiary address from event ${eventData._beneficiary} 
            must be equal to ${redeemRequest.beneficiary}.`,
    );

    assert.strictEqual(
      redeemRequest.amount.eq(eventData.amount),
      true,
      `Amount from event ${eventData._amount} must be equal 
            to ${redeemRequest.amount.toString(10)}.`,
    );

    assert.strictEqual(
      redeemRequest.gasPrice.eq(eventData.gasPrice),
      true,
      `GasPrice from event ${eventData.gasPrice} must be equal 
            to ${redeemRequest.gasPrice.toString(10)}.`,
    );

    assert.strictEqual(
      redeemRequest.gasLimit.eq(eventData.gasLimit),
      true,
      `Gas limit from event ${eventData.gasLimit} must be equal 
            to ${redeemRequest.gasLimit.toString(10)}.`,
    );
  }

  /**
     * Returns ETH balance wrapped in BN.
     * @param {string} address Address for which balance is requested.
     * @return {Promise<BN>} ETH Balance.
     * @private
     */
  async _getEthBalance(address) {
    const balance = await this.web3.eth.getBalance(address);
    return new BN(balance);
  }
}

module.exports = RequestRedeemAssertion;
