import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import * as jwt from 'jsonwebtoken';
import { randomBytes, scryptSync } from 'crypto';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const derived = scryptSync(password, salt, 64).toString('hex');
  return derived === key;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    const existing = await this.prisma.merchant.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const passwordHash = hashPassword(dto.password);
    const merchant = await this.prisma.merchant.create({
      data: { email: dto.email, passwordHash },
    });

    const token = jwt.sign(
      { merchant_id: merchant.id },
      process.env.JWT_SECRET ?? 'default-secret-change-me',
      {
        expiresIn: '1h',
      },
    );

    return { access_token: token };
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const merchant = await this.prisma.merchant.findUnique({ where: { email: dto.email } });
    if (!merchant) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!merchant.passwordHash || !verifyPassword(dto.password, merchant.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = jwt.sign(
      { merchant_id: merchant.id },
      process.env.JWT_SECRET ?? 'default-secret-change-me',
      {
        expiresIn: '1h',
      },
    );

    return { access_token: token };
  }
}
