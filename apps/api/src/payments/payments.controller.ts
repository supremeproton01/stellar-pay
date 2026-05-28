import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentMerchant } from '../auth/decorators/current-merchant.decorator.js';
import { type MerchantUser } from '../auth/interfaces/merchant-user.interface.js';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto.js';
import { PaymentsService, type CreatePaymentIntentResponse } from './payments.service.js';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new payment intent' })
  @ApiResponse({
    status: 201,
    description: 'Payment intent created successfully',
    schema: {
      type: 'object',
      properties: {
        payment_id: { type: 'string' },
        payment_reference: { type: 'string' },
        checkout_url: { type: 'string' },
        status: { type: 'string' },
        created_at: { type: 'string' },
        expires_at: { type: 'string' },
      },
    },
  })
  createPaymentIntent(
    @Body() dto: CreatePaymentIntentDto,
    @CurrentMerchant() merchant: MerchantUser,
  ): CreatePaymentIntentResponse {
    return this.paymentsService.createPaymentIntent(dto, merchant.merchant_id);
  }
}
