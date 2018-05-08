pragma solidity ^0.4.23;

// Copyright 2018 OpenST Ltd.
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
// Utility chain: Workers
//
// http://www.simpletoken.org/
//
// ----------------------------------------------------------------------------

import "./SafeMath.sol";
import "./EIP20TokenInterface.sol";
import "./ProtocolVersioned.sol";
import "./Owned.sol";

/// A set of authorised workers
contract Workers is ProtocolVersioned, Owned {
    using SafeMath for uint256;
    /// EIP20token address is private for now.
    EIP20Token private eip20token;
    /*
     *  Storage
     */
    /// workers are active up unto the deactivation height
    mapping(address => uint256 /* deactivation height */) public workers;

    /*
     * Events
     */
    ///Event for worker set
    event WorkerSet(
        address indexed _worker,
        uint256 indexed _deactivationHeight,
        uint256 _remainingHeight);

    ///Event for worker removed
    event WorkerRemoved(
        address indexed _worker,
        bool _existed);

    /// @dev    Constructor;
    ///         public method;    
    constructor(
        address _eip20token)
        public
        ProtocolVersioned(_protocol)
    {
        require(_eip20token != address(0));
        require(_protocol != address(0));
        
        eip20token = _eip20token;
    }

    /// @dev    Takes _worker, _deactivationHeight;
    ///         Sets worker and its deactivation height; 
    ///         external method;
    /// @param _worker worker
    /// @param _deactivationHeight deactivationHeight
    /// @return (remainingHeight)    
    function setWorker(
        address _worker,
        uint256 _deactivationHeight)
        external
        onlyOwner()
        returns (uint256 /* remaining activation length */)
    {
        require(_worker != address(0));
        require(_deactivationHeight >= block.number);

        workers[_worker] = _deactivationHeight;
        uint256 remainingHeight = _deactivationHeight - block.number;
        //Event for worker set
        WorkerSet(_worker, _deactivationHeight, remainingHeight);

        return (remainingHeight);
    }

    /// @dev    Takes _worker;
    ///         removes the worker; 
    ///         external method;
    /// @param _worker worker
    /// @return (existed)    
    function removeWorker(
        address _worker)
        external
        onlyOwner()
        returns (bool existed)
    {
        existed = (workers[_worker] > 0);

        delete workers[_worker];
        //Event for worker removed
        WorkerRemoved(_worker, existed);

        return existed;
    }
    
    /// @dev    Clean up or collectively revoke all workers;
    ///         external method;
    ///         only called by ops or admin;    
    function remove()
        external
        onlyOwner()
    {
        selfdestruct(msg.sender);
    }

    /// @dev    Takes _worker;
    ///         checks if the worker is valid; 
    ///         external method;
    /// @param _worker worker
    /// @return (isValid)    
    function isWorker(
        address _worker)
        external
        view
        returns (bool /* is active worker */)
    {
        return (workers[_worker] >= block.number);
    }

    function approve(
        address _spender,
        uint256 _amount)
        external
        onlyOwner()
        returns (bool success)
    {
        /// check if the allowance exists for spender address
        require(eip20token.allowance(msg.sender, _spender) >= uint256(0));
        /// approve the spender for the amount
        require(eip20token.approve(_spender, _amount));
        /// Emit Approval event    
        Approval(msg.sender, _spender, _amount);

        return true;
    }

}