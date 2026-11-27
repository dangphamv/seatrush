import { Body, Controller, HttpCode, Inject, Param, ParseIntPipe, ParseUUIDPipe, Post } from "@nestjs/common";
import { ClientId } from "../common/http.js";
import { PaymentsService, type WebhookBody } from "./payments.service.js";

@Controller()
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Post("orders/:id/checkout")
  @HttpCode(200)
  checkout(@Param("id", ParseUUIDPipe) id: string, @ClientId() clientId: string) {
    return this.payments.checkout(id, clientId);
  }

  // Trả 200 cả khi trùng/bỏ qua: cổng thanh toán chỉ cần biết đã nhận, không gửi lại.
  @Post("payments/webhook")
  @HttpCode(200)
  async webhook(@Body() body: WebhookBody) {
    return { ok: true, outcome: await this.payments.handleWebhook(body) };
  }

  @Post("payments/fake/:code/pay")
  @HttpCode(200)
  async fakePay(@Param("code", ParseIntPipe) code: number) {
    return { ok: true, outcome: await this.payments.fakePay(code) };
  }
}
