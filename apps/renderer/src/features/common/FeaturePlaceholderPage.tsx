type FeaturePlaceholderPageProps = {
  title: string;
  description: string;
};

export function FeaturePlaceholderPage({
  title,
  description
}: FeaturePlaceholderPageProps) {
  return (
    <section style={{ padding: "1rem 1.25rem" }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p style={{ color: "#57606a", maxWidth: "72ch" }}>{description}</p>
    </section>
  );
}

