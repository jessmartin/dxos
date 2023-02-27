# Class `ClientServicesProxy`
<sub>Declared in [packages/sdk/client-services/dist/types/src/packlets/services/service-proxy.d.ts:7]()</sub>


Implements services that are not local to the app.
For example, the services can be located in Wallet Extension.

## Constructors
### [constructor(port, \[_timeout\])]()


Returns: <code>[ClientServicesProxy](/api/@dxos/react-client/classes/ClientServicesProxy)</code>

Arguments: 

`port`: <code>RpcPort</code>

`_timeout`: <code>number</code>

## Properties
### [descriptors]()
Type: <code>ServiceBundle&lt;ClientServices&gt;</code>
### [proxy]()
Type: <code>ProtoRpcPeer&lt;ClientServices&gt;</code>
### [services]()
Type: <code>ClientServices</code>

## Methods
### [close()]()


Returns: <code>Promise&lt;void&gt;</code>

Arguments: none
### [open()]()


Returns: <code>Promise&lt;void&gt;</code>

Arguments: none