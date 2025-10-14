// api-gateway/src/admin/admin.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from './guard/admin-auth.guard';

@ApiTags('Admin')
@Controller('api/admin')
@UseGuards(AdminAuthGuard)
@ApiSecurity('X-Admin-Key')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Blockchain Health Check
   */
  @Get('health')
  @ApiOperation({
    summary: 'Blockchain health check',
    description: 'Check blockchain connectivity, admin account balance, and contract deployment status',
  })
  @ApiResponse({ status: 200, description: 'Health check completed' })
  async healthCheck() {
    return this.adminService.healthCheck();
  }

  /**
   * Get blockchain statistics
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get blockchain statistics',
    description: 'Get total pets, total guardians, and latest block info',
  })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStats() {
    return this.adminService.getBlockchainStats();
  }

  /**
   * Get guardian profile
   */
  @Get('guardian/:address')
  @ApiOperation({
    summary: 'Get guardian profile by address',
    description: 'Get full guardian profile including pets and verification status',
  })
  @ApiResponse({ status: 200, description: 'Guardian profile retrieved' })
  async getGuardianProfile(@Param('address') address: string) {
    return this.adminService.getGuardianProfile(address);
  }

  /**
   * Get pet info
   */
  @Get('pet/:petDID')
  @ApiOperation({
    summary: 'Get pet DID document and info',
    description: 'Get complete pet information including DID document, biometric data, and history',
  })
  @ApiResponse({ status: 200, description: 'Pet info retrieved' })
  async getPetInfo(@Param('petDID') petDID: string) {
    return this.adminService.getPetInfo(petDID);
  }

  /**
   * Get pets by controller
   */
  @Get('pets/controller/:address')
  @ApiOperation({
    summary: 'Get all pets by controller address',
    description: 'Get list of all pet DIDs controlled by a specific address',
  })
  @ApiResponse({ status: 200, description: 'Pets retrieved' })
  async getPetsByController(@Param('address') address: string) {
    return this.adminService.getPetsByController(address);
  }

  /**
   * Check authorization
   */
  @Get('check-auth')
  @ApiOperation({
    summary: 'Check if address is authorized guardian for pet',
    description: 'Verify if a guardian address is authorized to manage a pet',
  })
  @ApiResponse({ status: 200, description: 'Authorization checked' })
  async checkAuthorization(
    @Query('petDID') petDID: string,
    @Query('guardianAddress') guardianAddress: string,
  ) {
    return this.adminService.checkAuthorization(petDID, guardianAddress);
  }

  /**
   * Get transaction receipt
   */
  @Get('tx/:txHash')
  @ApiOperation({
    summary: 'Get transaction receipt by hash',
    description: 'Get detailed transaction receipt information',
  })
  @ApiResponse({ status: 200, description: 'Transaction receipt retrieved' })
  async getTransactionReceipt(@Param('txHash') txHash: string) {
    return this.adminService.getTransactionReceipt(txHash);
  }

  /**
   * Get block info
   */
  @Get('block/:blockNumber')
  @ApiOperation({
    summary: 'Get block by number',
    description: 'Get detailed block information',
  })
  @ApiResponse({ status: 200, description: 'Block info retrieved' })
  async getBlock(@Param('blockNumber') blockNumber: string) {
    return this.adminService.getBlock(parseInt(blockNumber));
  }
}
