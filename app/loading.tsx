export default function Loading() {
  return (
    <div role="status" className="mx-auto max-w-lg px-5 py-20 text-center">
      <span
        aria-hidden="true"
        className="inline-block size-10 animate-spin rounded-full border-4 border-line border-t-foreground motion-reduce:animate-none"
      />
      <p className="mt-5 text-sm font-semibold text-muted">
        잠깐만, 준비하고 있어요.
      </p>
    </div>
  );
}
