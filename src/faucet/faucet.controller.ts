// api-gateway/src/faucet/faucet.controller.ts
import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { FaucetProxyService } from './faucet.proxy.service';
import { RequestFundsDto } from './dto/request-funds.dto';
import { GetBalanceDto } from './dto/get-balance.dto';
import { GetHistoryDto } from './dto/get-history.dto';
import { DIDAuthGuard } from 'src/auth/guard/did-auth-guard';

@Controller('faucet')
@ApiTags('Faucet')
export class FaucetController {
  constructor(private faucetProxyService: FaucetProxyService) {}

  /**
   * Request test ETH from faucet
   */
  @Post('request')
  @UseGuards(DIDAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Request Test ETH from Faucet',
    description: `
**Request test ETH from the faucet service for development and testing purposes**

This endpoint allows authenticated users to request test ETH from the faucet. The faucet provides test tokens for interacting with the blockchain on test networks.

**How It Works:**
1. User authenticates with DID-based JWT token
2. Requests specific amount of test ETH (or default 100 ETH)
3. Faucet validates request and checks cooldown period
4. Sends test ETH to user's wallet address
5. Transaction is recorded on blockchain

**Cooldown System:**
- Prevents abuse by limiting requests per wallet
- Cooldown period configured by FAUCET_COOLDOWN_MINUTES (default: 60 minutes)
- If cooldown active, returns remaining time until next request allowed

**Request Flow:**
\`\`\`javascript
// Example request
const response = await fetch('/faucet/request', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    walletAddress: "0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0",
    amount: "100"  // Optional - default is 100 ETH
  })
});

const result = await response.json();
console.log('Transaction Hash:', result.data.transactionHash);
console.log('Amount Sent:', result.data.amount + ' ETH');
\`\`\`

**Request Body:**
\`\`\`javascript
{
  walletAddress: "0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0",  // Required - Ethereum address
  amount: "100"  // Optional - default 100 ETH, max determined by FAUCET_MAX_AMOUNT
}
\`\`\`

**Response - Success:**
\`\`\`javascript
{
  success: true,
  data: {
    transactionHash: "0xabcdef1234567890...",
    walletAddress: "0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0",
    amount: "100",
    timestamp: "2024-01-15T10:30:00.000Z"
  },
  message: "Funds sent successfully",
  timestamp: "2024-01-15T10:30:00.000Z"
}
\`\`\`

**Response - Cooldown Active:**
\`\`\`javascript
{
  success: false,
  data: null,
  errorCode: "COOLDOWN_ACTIVE",
  errorMessage: "Please wait 45 minutes before requesting again",
  retryable: true,
  timestamp: "2024-01-15T10:30:00.000Z",
  message: "Cooldown period active"
}
\`\`\`

**Response - Invalid Address:**
\`\`\`javascript
{
  success: false,
  data: null,
  errorCode: "INVALID_ADDRESS",
  errorMessage: "Invalid wallet address format",
  retryable: false,
  timestamp: "2024-01-15T10:30:00.000Z",
  message: "Invalid wallet address"
}
\`\`\`

**Response - Amount Too High:**
\`\`\`javascript
{
  success: false,
  data: null,
  errorCode: "AMOUNT_TOO_HIGH",
  errorMessage: "Amount exceeds maximum of 1000 ETH",
  retryable: false,
  timestamp: "2024-01-15T10:30:00.000Z",
  message: "Amount too high"
}
\`\`\`

**Validation Rules:**
- Wallet address must be valid Ethereum address (42 chars, starts with 0x)
- Amount must not exceed FAUCET_MAX_AMOUNT configuration
- Wallet must not be in cooldown period
- Faucet must have sufficient balance

**Use Cases:**
- **Development:** Get test ETH for deploying smart contracts
- **Testing:** Obtain tokens for testing DApp functionality
- **Onboarding:** New users get initial test ETH for gas fees
- **QA:** Quality assurance testing with fresh wallets

**Important Notes:**
- **Test Network Only:** This faucet is for test/development networks only
- **No Real Value:** Test ETH has no real monetary value
- **Rate Limited:** Cooldown period prevents abuse
- **Balance Check:** Faucet must have sufficient balance
- **Transaction Fee:** No gas fee charged (test network)

**Error Cases:**
- Invalid wallet address → FAUCET_4001 (INVALID_ADDRESS)
- Amount exceeds max → FAUCET_4002 (AMOUNT_TOO_HIGH)
- Cooldown active → FAUCET_5001 (COOLDOWN_ACTIVE)
- Transaction failed → FAUCET_5002 (TRANSACTION_FAILED)
- Insufficient faucet balance → FAUCET_5002 (TRANSACTION_FAILED)

**HTTP Status Codes:**
- 200: Request processed (check success field in response)
- 401: Unauthorized (invalid or missing token)
- 400: Bad Request (validation failed)
- 500: Internal Server Error (service unavailable)
    `,
  })
  @ApiBody({ type: RequestFundsDto })
  @ApiResponse({
    status: 200,
    description: 'Request processed successfully - check success field in response',
    schema: {
      oneOf: [
        {
          description: 'Success - Funds sent',
          example: {
            success: true,
            data: {
              transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
              walletAddress: '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
              amount: '100',
              timestamp: '2024-01-15T10:30:00.000Z'
            },
            message: 'Funds sent successfully',
            timestamp: '2024-01-15T10:30:00.000Z'
          }
        },
        {
          description: 'Error - Cooldown active',
          example: {
            success: false,
            data: null,
            errorCode: 'COOLDOWN_ACTIVE',
            errorMessage: 'Please wait 45 minutes before requesting again',
            retryable: true,
            timestamp: '2024-01-15T10:30:00.000Z',
            message: 'Cooldown period active'
          }
        },
        {
          description: 'Error - Invalid address',
          example: {
            success: false,
            data: null,
            errorCode: 'INVALID_ADDRESS',
            errorMessage: 'Invalid wallet address format',
            retryable: false,
            timestamp: '2024-01-15T10:30:00.000Z',
            message: 'Invalid wallet address'
          }
        },
        {
          description: 'Error - Amount too high',
          example: {
            success: false,
            data: null,
            errorCode: 'AMOUNT_TOO_HIGH',
            errorMessage: 'Amount exceeds maximum of 1000 ETH',
            retryable: false,
            timestamp: '2024-01-15T10:30:00.000Z',
            message: 'Amount too high'
          }
        }
      ]
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing access token'
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid request body or validation failed'
  })
  async requestFunds(@Body() body: RequestFundsDto) {
    const { walletAddress, amount } = body;
    return this.faucetProxyService.requestFunds(walletAddress, amount);
  }

  /**
   * Get balance of faucet or specific address
   */
  @Get('balance')
  @UseGuards(DIDAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get Balance of Faucet or Specific Wallet',
    description: `
**Check the balance of the faucet or any specific wallet address**

This endpoint allows you to query the ETH balance of either the faucet service itself or any specific wallet address. Useful for monitoring faucet funds and verifying user balances.

**How It Works:**
1. User authenticates with DID-based JWT token
2. Optionally provides wallet address to check
3. If no address provided, returns faucet's own balance
4. Service queries blockchain for current balance
5. Returns balance in ETH

**Use Cases:**
- **Monitor Faucet:** Check if faucet has sufficient funds
- **Verify Receipt:** Confirm test ETH was received after request
- **Balance Check:** Check user wallet balance before transactions
- **Dashboard:** Display faucet status on admin dashboard

**Request Flow:**
\`\`\`javascript
// Check faucet balance
const faucetBalance = await fetch('/faucet/balance', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + accessToken
  }
});

// Check specific wallet balance
const walletBalance = await fetch('/faucet/balance?address=0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + accessToken
  }
});

const result = await faucetBalance.json();
console.log('Balance:', result.data.balance + ' ETH');
console.log('Address:', result.data.address);
\`\`\`

**Query Parameters:**
- \`address\` (optional): Wallet address to check balance
  - If provided: Returns balance of specified address
  - If omitted: Returns balance of faucet service

**Response - Success:**
\`\`\`javascript
{
  success: true,
  data: {
    balance: "1234.5678",  // Balance in ETH
    address: "0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0"  // Checked address
  },
  timestamp: "2024-01-15T10:30:00.000Z"
}
\`\`\`

**Response - Error:**
\`\`\`javascript
{
  success: false,
  data: null,
  errorCode: "BALANCE_CHECK_FAILED",
  errorMessage: "Failed to retrieve balance from blockchain",
  retryable: true,
  timestamp: "2024-01-15T10:30:00.000Z"
}
\`\`\`

**Important Notes:**
- Balance is returned as string to preserve precision
- Balance is in ETH, not Wei
- Faucet address is configured via FAUCET_WALLET_ADDRESS environment variable
- Real-time balance from blockchain (not cached)

**Error Cases:**
- Invalid address format → Blockchain query fails
- Network error → FAUCET_5003 (BALANCE_CHECK_FAILED)
- RPC connection error → FAUCET_5003 (BALANCE_CHECK_FAILED)

**HTTP Status Codes:**
- 200: Success (check success field in response)
- 401: Unauthorized (invalid or missing token)
- 500: Internal Server Error (blockchain connection failed)
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Balance retrieved successfully',
    schema: {
      oneOf: [
        {
          description: 'Success',
          example: {
            success: true,
            data: {
              balance: '1234.5678',
              address: '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0'
            },
            timestamp: '2024-01-15T10:30:00.000Z'
          }
        },
        {
          description: 'Error - Balance check failed',
          example: {
            success: false,
            data: null,
            errorCode: 'BALANCE_CHECK_FAILED',
            errorMessage: 'Failed to retrieve balance from blockchain',
            retryable: true,
            timestamp: '2024-01-15T10:30:00.000Z'
          }
        }
      ]
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing access token'
  })
  async getFaucetBalance(@Query() query: GetBalanceDto) {
    return this.faucetProxyService.getFaucetBalance(query.address);
  }

  /**
   * Get faucet transaction history
   */
  @Get('history')
  @UseGuards(DIDAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get Faucet Transaction History',
    description: `
**Retrieve transaction history from the faucet service**

This endpoint returns a list of recent faucet transactions, either for all wallets or filtered by a specific wallet address. Useful for tracking faucet usage, auditing, and debugging.

**How It Works:**
1. User authenticates with DID-based JWT token
2. Optionally provides wallet address filter and result limit
3. Service retrieves transaction records from memory/database
4. Returns sorted list of transactions (most recent first)

**Use Cases:**
- **User History:** Show user's past faucet requests
- **Admin Dashboard:** Monitor all faucet activity
- **Audit Trail:** Track faucet usage for compliance
- **Debugging:** Investigate failed or pending transactions
- **Analytics:** Analyze usage patterns

**Request Flow:**
\`\`\`javascript
// Get all recent transactions (last 10)
const allHistory = await fetch('/faucet/history', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + accessToken
  }
});

// Get specific wallet's transactions (last 20)
const walletHistory = await fetch('/faucet/history?address=0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0&limit=20', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + accessToken
  }
});

const result = await allHistory.json();
console.log('Transaction Count:', result.data.transactions.length);
result.data.transactions.forEach(tx => {
  console.log(\`\${tx.toAddress} received \${tx.amount} ETH at \${tx.timestamp}\`);
});
\`\`\`

**Query Parameters:**
- \`address\` (optional): Filter by specific wallet address
  - If provided: Returns only transactions for this address
  - If omitted: Returns all recent transactions
- \`limit\` (optional, default: 10, max: 100): Number of transactions to return

**Response - Success:**
\`\`\`javascript
{
  success: true,
  data: {
    transactions: [
      {
        transactionHash: "0xabcdef1234567890...",
        toAddress: "0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0",
        amount: "100",
        timestamp: "2024-01-15T10:30:00.000Z",
        status: "success"  // "success" or "failed"
      },
      {
        transactionHash: "0x1234567890abcdef...",
        toAddress: "0x1234567890123456789012345678901234567890",
        amount: "50",
        timestamp: "2024-01-15T10:25:00.000Z",
        status: "success"
      }
    ]
  },
  timestamp: "2024-01-15T10:30:00.000Z"
}
\`\`\`

**Response - Error:**
\`\`\`javascript
{
  success: false,
  data: null,
  errorCode: "HISTORY_FETCH_FAILED",
  errorMessage: "Failed to retrieve transaction history",
  retryable: true,
  timestamp: "2024-01-15T10:30:00.000Z"
}
\`\`\`

**Transaction Status:**
- \`success\`: Transaction confirmed on blockchain
- \`failed\`: Transaction reverted or failed

**Important Notes:**
- Transactions are sorted by timestamp (most recent first)
- History is stored in-memory (may be lost on service restart)
- Consider implementing persistent storage for production
- Limit parameter is capped at 100 to prevent excessive data transfer
- Empty array returned if no transactions found

**Pagination:**
Currently this endpoint does not support pagination. For production:
- Consider adding \`offset\` parameter for pagination
- Consider adding date range filters
- Consider implementing cursor-based pagination

**Error Cases:**
- Database/storage error → FAUCET_5004 (HISTORY_FETCH_FAILED)
- Invalid address format → Returns empty array

**HTTP Status Codes:**
- 200: Success (check success field in response)
- 401: Unauthorized (invalid or missing token)
- 400: Bad Request (invalid query parameters)
- 500: Internal Server Error (storage access failed)
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction history retrieved successfully',
    schema: {
      oneOf: [
        {
          description: 'Success',
          example: {
            success: true,
            data: {
              transactions: [
                {
                  transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
                  toAddress: '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
                  amount: '100',
                  timestamp: '2024-01-15T10:30:00.000Z',
                  status: 'success'
                },
                {
                  transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                  toAddress: '0x1234567890123456789012345678901234567890',
                  amount: '50',
                  timestamp: '2024-01-15T10:25:00.000Z',
                  status: 'success'
                }
              ]
            },
            timestamp: '2024-01-15T10:30:00.000Z'
          }
        },
        {
          description: 'Error - History fetch failed',
          example: {
            success: false,
            data: null,
            errorCode: 'HISTORY_FETCH_FAILED',
            errorMessage: 'Failed to retrieve transaction history',
            retryable: true,
            timestamp: '2024-01-15T10:30:00.000Z'
          }
        }
      ]
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing access token'
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid query parameters'
  })
  async getFaucetHistory(@Query() query: GetHistoryDto) {
    return this.faucetProxyService.getFaucetHistory(query.address, query.limit);
  }

  /**
   * Health Check - Faucet 서비스 gRPC 연결 상태 확인
   */
  @Get('health')
  @ApiOperation({
    summary: 'Check Faucet Service Health',
    description: `
**Check the health status of the faucet gRPC service**

This endpoint performs a health check on the faucet microservice to verify it's running and accessible. Returns detailed status information about the service and blockchain connectivity.

**How It Works:**
1. Sends health check request to faucet gRPC service
2. Faucet service checks blockchain connectivity
3. Returns service status, blockchain info, and balance

**Use Cases:**
- **Monitoring:** Automated health checks for service monitoring
- **Dashboard:** Display service status on admin dashboard
- **Debugging:** Verify faucet service is running before operations
- **CI/CD:** Pre-deployment health verification

**Request Flow:**
\`\`\`javascript
const health = await fetch('/faucet/health', {
  method: 'GET'
});

const result = await health.json();
console.log('Service Status:', result.status);
console.log('gRPC Status:', result.grpcStatus);
console.log('Message:', result.message);
\`\`\`

**Response - Service Healthy:**
\`\`\`javascript
{
  status: "success",
  grpcStatus: 1,  // 1 = SERVING
  message: "Faucet service is healthy. Block: 12345, Balance: 1000.5 ETH",
  timestamp: "2024-01-15T10:30:00.000Z",
  version: "1.0.0"
}
\`\`\`

**Response - Service Unhealthy:**
\`\`\`javascript
{
  status: "error",
  grpcStatus: "NOT_SERVING",  // 2 = NOT_SERVING
  message: "Failed to connect to Faucet gRPC service",
  timestamp: "2024-01-15T10:30:00.000Z"
}
\`\`\`

**gRPC Status Codes:**
- \`0\` (UNKNOWN): Status unknown
- \`1\` (SERVING): Service is healthy and serving requests
- \`2\` (NOT_SERVING): Service is not healthy
- \`3\` (SERVICE_UNKNOWN): Service not found

**Health Check Details:**
The faucet service health check includes:
1. gRPC connection test
2. Web3 provider connectivity
3. Current blockchain block number
4. Faucet wallet balance

**Important Notes:**
- This endpoint does NOT require authentication
- Use for automated monitoring and alerting
- Health check is lightweight and fast
- Does not modify any state

**Monitoring Integration:**
\`\`\`javascript
// Example: Prometheus exporter
async function checkFaucetHealth() {
  const response = await fetch('/faucet/health');
  const health = await response.json();

  // Set metrics
  faucet_service_up.set(health.status === 'success' ? 1 : 0);
  faucet_grpc_status.set(health.grpcStatus);

  return health.status === 'success';
}

// Poll every 30 seconds
setInterval(checkFaucetHealth, 30000);
\`\`\`

**HTTP Status Codes:**
- 200: Always returns 200 (check status field for actual health)

**Error Cases:**
- gRPC connection timeout → status: "error"
- Blockchain RPC error → status: "error", message includes error details
- Service not running → status: "error", grpcStatus: "NOT_SERVING"
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Health check completed - check status field for actual health',
    schema: {
      oneOf: [
        {
          description: 'Service Healthy',
          example: {
            status: 'success',
            grpcStatus: 1,
            message: 'Faucet service is healthy. Block: 12345, Balance: 1000.5 ETH',
            timestamp: '2024-01-15T10:30:00.000Z',
            version: '1.0.0'
          }
        },
        {
          description: 'Service Unhealthy',
          example: {
            status: 'error',
            grpcStatus: 'NOT_SERVING',
            message: 'Failed to connect to Faucet gRPC service',
            timestamp: '2024-01-15T10:30:00.000Z'
          }
        }
      ]
    }
  })
  async healthCheck() {
    try {
      const result = await this.faucetProxyService.healthCheck('FaucetService');
      return {
        status: 'success',
        grpcStatus: result.status,
        message: result.message,
        timestamp: result.timestamp,
        version: result.version,
      };
    } catch (error) {
      return {
        status: 'error',
        grpcStatus: 'NOT_SERVING',
        message: error.message || 'Failed to connect to Faucet gRPC service',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
