/** Oturumun raporu. Markdown tek kaynaktır: ekranda gösterilen de, kopyalanan
 *  da, indirilen de `buildMarkdown` çıktısıdır. */
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ErrorMsg, Loading } from "../../components/Pickers";
import { useT } from "../../lib/i18n";
import { buildMarkdown, reportFilename } from "../core/report";
import { useSession } from "../core/store";
import "../woa.css";

/** Yalnız `buildMarkdown`ın ürettiği alt küme: başlık, liste, alıntı, kalın,
 *  italik. Genel amaçlı bir markdown motoruna gerek yok. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_)/g;
  let last = 0, m: RegExpExecArray | null, key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    out.push(token.startsWith("**")
      ? <strong key={key++}>{token.slice(2, -2)}</strong>
      : <em key={key++}>{token.slice(1, -1)}</em>);
    last = m.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ src }: { src: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`l${blocks.length}`}>
        {list.map((li, i) => <li key={i}>{inline(li)}</li>)}
      </ul>);
    list = [];
  };

  for (const line of src.split("\n")) {
    if (line.startsWith("- ")) { list.push(line.slice(2)); continue; }
    flush();
    if (!line.trim()) continue;
    if (line.startsWith("#### "))
      blocks.push(<h4 key={blocks.length}>{inline(line.slice(5))}</h4>);
    else if (line.startsWith("### "))
      blocks.push(<h3 key={blocks.length}>{inline(line.slice(4))}</h3>);
    else if (line.startsWith("## "))
      blocks.push(<h2 key={blocks.length}>{inline(line.slice(3))}</h2>);
    else if (line.startsWith("# "))
      blocks.push(<h1 key={blocks.length}>{inline(line.slice(2))}</h1>);
    else if (line.startsWith("> "))
      blocks.push(<blockquote key={blocks.length}>{inline(line.slice(2))}</blockquote>);
    else blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="woa-report">{blocks}</div>;
}

export default function WoaReport() {
  const { id } = useParams();
  const t = useT();
  const navigate = useNavigate();
  const { session, loading, update } = useSession(id);
  const [copied, setCopied] = useState(false);

  const md = useMemo(() => (session ? buildMarkdown(session) : ""), [session]);

  if (loading) return <Loading />;
  if (!session) return <ErrorMsg msg={t("woa.session.missing")} />;

  async function copy() {
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = reportFilename(session!);
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="woa-reportpage">
      <div className="woa-report__actions">
        <button className="pill small" onClick={() => navigate(`/woa/${session.id}`)}>
          ← {t("woa.report.back")}
        </button>
        <button className="pill small" onClick={() => void copy()}>
          {copied ? t("woa.report.copied") : t("woa.report.copy")}
        </button>
        <button className="pill small" onClick={download}>{t("woa.report.download")}</button>
        <button className="pill small" onClick={() => window.print()}>
          {t("woa.report.print")}
        </button>
        {session.status === "done" && (
          <button className="pill small"
                  onClick={() => update((s) => ({ ...s, status: "active" }))}>
            {t("woa.report.reopen")}
          </button>
        )}
      </div>
      <Markdown src={md} />
    </section>
  );
}
