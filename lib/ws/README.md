# WebSockets Layer

Socket layer is composed of connection middlewares that hook into connection the lifecycle.

## Lifecycle

- **handleEstablish(connection)**
    - initial connection handshake
    - it's guaranteed to run once per connection without errors
    - middlewares are notified in order of registration
- **handleIncoming(message)**
    - every incoming message will pass through in a serial fashion
    - middlewares are applied in order of registration
- **handleOutgoing(message)**
    - every outgoing message will
    - middleware are applied in reverse order of registration
- **handleClose(connection)**
    - connection close and cleanup
    - it's guaranteed to run once per connection
    - middlewares are notified in order of registration
- **handleError(error, connection)**
    - error handling
    - not yet implemented

## Middlewares

There are two kinds of middlewares:
- apply middleware
- notify middleware
