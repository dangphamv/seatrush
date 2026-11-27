import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-3xl font-extrabold">Không tìm thấy trang</h1>
      <Link href="/" className="mt-4 inline-block text-accent underline">Về danh sách sự kiện</Link>
    </div>
  );
}
