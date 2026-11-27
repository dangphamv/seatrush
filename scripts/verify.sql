-- OPS-01: kiểm bất biến trong docs/data-model.md sau mỗi lần chạy tải. Vi phạm → lỗi, exit code ≠ 0.
\pset footer off
select
  (select count(*) from seats where status = 'sold') as sold_seats,
  (select count(*) from tickets) as tickets,
  (select count(*) from orders where status = 'confirmed') as confirmed_orders,
  (select count(*) from orders where status = 'refund_required') as refund_orders,
  (select count(*) from notifications) as notifications;

do $$
declare n bigint;
begin
  select count(*) into n from (select seat_id from tickets group by seat_id having count(*) > 1) d;
  if n > 0 then raise exception 'FAIL: % ghế có hơn 1 vé', n; end if;

  select count(*) into n from seats s left join tickets t on t.seat_id = s.id where s.status = 'sold' and t.id is null;
  if n > 0 then raise exception 'FAIL: % ghế sold không có vé', n; end if;

  select count(*) into n from tickets t join orders o on o.id = t.order_id where o.status <> 'confirmed';
  if n > 0 then raise exception 'FAIL: % vé thuộc đơn chưa xác nhận', n; end if;

  select count(*) into n from orders o where o.status = 'confirmed' and o.quantity <> (select count(*) from tickets t where t.order_id = o.id);
  if n > 0 then raise exception 'FAIL: % đơn confirmed sai số vé', n; end if;

  select count(*) into n from payment_events p join orders o on o.id = p.order_id
    where p.outcome in ('confirmed', 'refund_required') and o.status not in ('confirmed', 'refund_required');
  if n > 0 then raise exception 'FAIL: % khoản tiền gắn với đơn không confirmed/refund', n; end if;

  raise notice 'OK: không bán trùng, mọi ghế sold có đúng 1 vé, mọi khoản tiền có kết cục';
end $$;
