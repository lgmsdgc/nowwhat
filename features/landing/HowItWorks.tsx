const steps = [
  "상황을 알려주면",
  "미션 하나를 고르고",
  "해보고 경험치를 쌓아요",
] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-label="이용 방법"
      className="mt-10 border-t border-line pt-6 sm:mt-16"
    >
      <ol className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-xs text-muted">
        {steps.map((title, index) => (
          <li key={title} className="flex items-center gap-2">
            <span className="font-medium text-foreground">{index + 1}</span>
            {title}
          </li>
        ))}
      </ol>
    </section>
  );
}
