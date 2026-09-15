import Link from "next/link";
import { notFound } from "next/navigation";

import { BracketBadge } from "@/components/bracket-badge";
import { CategoryBar } from "@/components/category-bar";
import { ColorPips } from "@/components/color-pips";
import { CurveChart } from "@/components/curve-chart";
import { Panel } from "@/components/panel";
import { ValidationBadge } from "@/components/validation-badge";
import { getDeckReport } from "@/lib/mock/deck-service";

export default async function DeckReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const report = await getDeckReport(slug);

  if (!report) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/decks" className="text-sm text-accent-secondary hover:underline">
        ← Decks
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-fg">{report.name}</h1>
          <p className="mt-1 text-muted">{report.commanders.join(" & ")}</p>
          <div className="mt-2">
            <ColorPips identity={report.identity} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <BracketBadge tier={report.bracket_estimate} />
          <ValidationBadge legal={report.validation.legal} />
        </div>
      </div>

      <div className="mt-8 grid gap-6">
        {(report.validation.issues.length > 0 || report.validation.warnings.length > 0) && (
          <Panel>
            <h2 className="text-lg font-medium text-fg">Validação</h2>
            <ul className="mt-3 space-y-1 text-sm">
              {report.validation.issues.map((issue) => (
                <li key={issue} className="text-accent-primary">
                  {issue}
                </li>
              ))}
              {report.validation.warnings.map((warning) => (
                <li key={warning} className="text-muted">
                  {warning}
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel>
          <h2 className="text-lg font-medium text-fg">Composição</h2>
          <div className="mt-4 space-y-4">
            {report.categories.map((category) => (
              <CategoryBar key={category.category} {...category} />
            ))}
          </div>
        </Panel>

        <Panel>
          <h2 className="text-lg font-medium text-fg">Curva de mana</h2>
          <div className="mt-4">
            <CurveChart curve={report.curve} />
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-medium text-fg">Bracket</h2>
            <BracketBadge tier={report.bracket_estimate} size="lg" />
          </div>
          <p className="mt-3 text-sm text-muted">{report.bracket_rationale}</p>
        </Panel>

        {report.game_changers.length > 0 && (
          <Panel>
            <h2 className="text-lg font-medium text-fg">Game Changers</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {report.game_changers.map((card) => (
                <li
                  key={card}
                  className="rounded-full border border-accent-primary/30 bg-accent-primary/10 px-3 py-1 text-sm text-fg/80"
                >
                  {card}
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {report.combos.length > 0 && (
          <Panel>
            <h2 className="text-lg font-medium text-fg">Combos</h2>
            <ul className="mt-3 space-y-1 text-sm text-fg/80">
              {report.combos.map((combo) => (
                <li key={combo}>{combo}</li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </main>
  );
}
