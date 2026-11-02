import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SignedIn, SignedInOnly } from '../../auth/decorators.js';
import type { SignedInUser } from '../../auth/request-context.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { availabilityQuery, signupBody, type AvailabilityQuery, type SignupBody } from './signup.schemas.js';
import { SignupService } from './signup.service.js';

// Apex host only: a signed-in person with no tenant yet.
@Controller('signup')
@SignedInOnly()
export class SignupController {
  constructor(private readonly signups: SignupService) {}

  @Get('slug-availability')
  availability(@Query(new ZodPipe(availabilityQuery)) query: AvailabilityQuery) {
    return this.signups.availability(query.slug);
  }

  @Post()
  signup(@SignedIn() user: SignedInUser, @Body(new ZodPipe(signupBody)) body: SignupBody) {
    return this.signups.signup(user, body);
  }
}
