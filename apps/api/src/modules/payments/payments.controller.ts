import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Headers,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreateRazorpayOrderDto } from './dto/create-razorpay-order.dto';
import { VerifyRazorpayPaymentDto } from './dto/verify-razorpay-payment.dto';
import { CreatePaymentRefundDto } from './dto/create-payment-refund.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantContext } from '@aescion/types';

@ApiTags('Payments - Razorpay')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('razorpay/create-order')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create Razorpay Order for Invoice payment' })
  @ApiResponse({ status: 200, description: 'Order created successfully' })
  async createRazorpayOrder(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateRazorpayOrderDto,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.paymentsService.createCheckoutOrder(tenant, dto, currentUserId);
  }

  @Post('razorpay/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify Razorpay payment signature and capture payment transactionally' })
  @ApiResponse({ status: 200, description: 'Payment verified and captured' })
  async verifyRazorpayPayment(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: VerifyRazorpayPaymentDto,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.paymentsService.verifyAndCapturePayment(tenant, dto, currentUserId);
  }

  @Post('razorpay/webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Public Razorpay Webhook listener with HMAC-SHA256 signature verification' })
  @ApiResponse({ status: 200, description: 'Webhook acknowledged' })
  async handleRazorpayWebhook(
    @Req() req: Request,
    @Headers('x-razorpay-signature') signature: string,
    @Headers('x-razorpay-event-id') eventId?: string,
    @Body() bodyJson?: any,
  ) {
    const rawBody =
      (req as any).rawBody ||
      (typeof req.body === 'string' ? req.body : Buffer.from(JSON.stringify(req.body)));
    return this.paymentsService.processWebhookEvent(rawBody, signature, eventId, bodyJson);
  }

  @Get('attempts/:invoiceId')
  @ApiOperation({ summary: 'Get payment attempts for an invoice' })
  @ApiResponse({ status: 200, description: 'List of payment attempts' })
  async getPaymentAttempts(
    @CurrentTenant() tenant: TenantContext,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.paymentsService.getPaymentAttempts(tenant, invoiceId);
  }

  @Post('razorpay/refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Owner/Manager-only initiate Razorpay refund' })
  @ApiResponse({ status: 200, description: 'Refund processed successfully' })
  async initiateRefund(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePaymentRefundDto,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.paymentsService.initiateRefund(tenant, dto, currentUserId);
  }

  @Post('razorpay/reconcile/:attemptId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Owner/Manager-only reconcile a pending payment attempt' })
  @ApiResponse({ status: 200, description: 'Reconciliation result' })
  async reconcilePaymentAttempt(
    @CurrentTenant() tenant: TenantContext,
    @Param('attemptId') attemptId: string,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.paymentsService.reconcilePaymentAttempt(tenant, attemptId, currentUserId);
  }

  @Get('refunds/:invoiceId')
  @ApiOperation({ summary: 'Get refund records for an invoice' })
  @ApiResponse({ status: 200, description: 'List of refund records' })
  async getRefunds(
    @CurrentTenant() tenant: TenantContext,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.paymentsService.getRefunds(tenant, invoiceId);
  }
}

