interface ResearchDisclaimerProps {
  text: string
}

export function ResearchDisclaimer({ text }: ResearchDisclaimerProps) {
  return (
    <aside className="disclaimer" aria-label="Research-use limitation">
      <span className="disclaimer__mark" aria-hidden="true">
        !
      </span>
      <div>
        <strong>Research use only</strong>
        <p>{text}</p>
      </div>
    </aside>
  )
}
