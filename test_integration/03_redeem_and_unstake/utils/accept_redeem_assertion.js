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
 * @property {string} facilitator Address of Facilitator.
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
 * @property {BN} balances.ostPrime.cogateway ERC20 balance of cogateway contract.
 * @property {BN} balances.ostPrime.redeemer ERC20 balance of beneficiary.
 * @property {BN} balances.baseToken.cogateway Base token(ETH) balance of cogateway.
 * @property {BN} balances.baseToken.redeemer Base token(ETH) balance of redeemer.
 */

/**
 * Class to assert event and balances after Accept redeem.
 */
class AcceptRedeemAssertion {
  /**
   * Constructor.
   * @param {Object} redeemPool Truffle redeemPool instance.
   * @param {Object} cogateway Truffle cogateway instance.
   * @param {Object} ostPrime Truffle token instance.
   * @param {Web3} web3 Web3 instance.
   */
  constructor(redeemPool, cogateway, ostPrime, web3) {
    this.redeemPool = redeemPool;
    this.cogateway = cogateway;
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
    await this._assertBalancesForRedeem(
      redeemRequest,
      initialBalances,
      transactionFees,
    );

    AcceptRedeemAssertion._assertRedeemEvent(event, redeemRequest);
  }

  /**
   * This captures base token and token balance of cogateway and facilitator
   * @param {string} facilitator Redeemer address.
   * @return {Promise<Balances>}
   */
  async captureBalances(facilitator) {
    return {
      baseToken: {
        redeemPool: await this._getEthBalance(this.redeemPool.address),
        cogateway: await this._getEthBalance(this.cogateway.address),
        facilitator: await this._getEthBalance(facilitator),

      },
      token: {
        redeemPool: await this.token.balanceOf(this.redeemPool.address),
        facilitator: await this.token.balanceOf(facilitator),
        cogateway: await this.token.balanceOf(this.cogateway.address),
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
  async _assertBalancesForRedeem(redeemRequest, initialBalances, transactionFees) {
    const finalBalances = await this.captureBalances(redeemRequest.facilitator);

    // Assert cogateway balance.
    const expectedCoGatewayBaseTokenBalance = initialBalances.baseToken.cogateway
      .add(redeemRequest.bounty);

    // Assert bounty is transferred to cogateway.
    assert.strictEqual(
      expectedCoGatewayBaseTokenBalance.eq(finalBalances.baseToken.cogateway),
      true,
      `CoGateway base token balance must be ${expectedCoGatewayBaseTokenBalance.toString(10)}`
           + ` instead of ${finalBalances.baseToken.cogateway.toString(10)}`,
    );

    const expectedCoGatewayTokenBalance = initialBalances.token.cogateway
      .add(redeemRequest.amount);

    // Assert Redeem amount is transferred to cogateway.
    assert.strictEqual(
      expectedCoGatewayTokenBalance.eq(finalBalances.token.cogateway),
      true,
      `CoGateway token balance must be ${expectedCoGatewayBaseTokenBalance.toString(10)}`
           + ` instead of ${finalBalances.token.cogateway.toString(10)}`,
    );

    // Assert redeemPool balance.
    const expectedRedeemPoolBaseTokenBalance = initialBalances.baseToken.redeemPool;

    assert.strictEqual(
      expectedRedeemPoolBaseTokenBalance.eq(finalBalances.baseToken.redeemer),
      true,
      `Redeem composer base token balance must be ${expectedRedeemPoolBaseTokenBalance.toString(10)}`
           + ` instead of ${finalBalances.baseToken.redeemer.toString(10)}`,
    );

    const expectedRedeemPoolTokenBalance = initialBalances.token.redeemPool
      .sub(redeemRequest.amount);

    // Assert Redeem amount is transferred from redeemer composer.
    assert.strictEqual(
      expectedRedeemPoolTokenBalance.eq(finalBalances.token.redeemer),
      true,
      `Redeemer token balance must be ${expectedRedeemPoolTokenBalance.toString(10)}`
           + ` instead of ${finalBalances.token.redeemer.toString(10)}`,
    );

    // Assert facilitator balance.
    const expectedFacilitatorBaseTokenBalance = initialBalances.baseToken.facilitator
      .sub(redeemRequest.bounty);

    assert.strictEqual(
      expectedFacilitatorBaseTokenBalance.eq(finalBalances.baseToken.facilitator),
      true,
      `Facilitator base token balance must be ${expectedFacilitatorBaseTokenBalance.toString(10)}`
      + ` instead of ${finalBalances.baseToken.facilitator.toString(10)}`,
    );

    const expectedFacilitatorTokenBalance = initialBalances.token.facilitator;

    assert.strictEqual(
      expectedFacilitatorTokenBalance.eq(finalBalances.token.facilitator),
      true,
      `Facilitator token balance must be ${expectedFacilitatorTokenBalance.toString(10)}`
      + ` instead of ${finalBalances.token.facilitator.toString(10)}`,
    );
  }

  /**
   * This asserts event after Redeem method.
   * @param {Object} event Event object after decoding.
   * @param {RedeemRequest} redeemRequest Redeem request parameters.
   * @private
   */
  static _assertRedeemEvent(event, redeemRequest) {
    const eventData = event.RedeemIntentDeclared;

    assert.strictEqual(
      eventData._redeemer.toLowerCase(),
      redeemRequest.redeemer.toLowerCase(),
      `Redeemer address from event ${eventData._redeemer} must be equal to ${redeemRequest.redeemer}.`,
    );

    assert.strictEqual(
      redeemRequest.nonce.eq(new BN(eventData._redeemerNonce)),
      true,
      `Redeemer nonce from event ${eventData._redeemerNonce} 
            must be equal to ${redeemRequest.nonce.toString(10)}.`,
    );

    assert.strictEqual(
      eventData._beneficiary.toLowerCase(),
      redeemRequest.beneficiary.toLowerCase(),
      `Beneficiary address from event ${eventData._beneficiary} 
            must be equal to ${redeemRequest.beneficiary}.`,
    );

    assert.strictEqual(
      redeemRequest.amount.eq(new BN(eventData._amount)),
      true,
      `Amount from event ${eventData._amount} must be equal 
            to ${redeemRequest.amount.toString(10)}.`,
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

module.exports = AcceptRedeemAssertion;