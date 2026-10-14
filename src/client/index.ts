import {
  INIT_URL,
  SSE_URL,
  LINE_BEGIN_ATTR,
  LINE_END_ATTR,
  type ServerMessage,
  type ServerMessageRegistry,
  type InitalizationParams,
} from '@tiulii/shared';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false });

const app = document.createElement('div');
document.body.prepend(app);

async function mermaidRender(element: Element) {
  const uuid = `mermaid-${crypto.randomUUID()}`;
  const { svg } = await mermaid.render(uuid, element.textContent);
  let lineAttrs = '';
  let line: string | null;
  if ((line = element.getAttribute(LINE_BEGIN_ATTR)) !== null)
    lineAttrs += ` ${LINE_BEGIN_ATTR}="${line}"`;
  if ((line = element.getAttribute(LINE_END_ATTR)) !== null)
    lineAttrs += ` ${LINE_END_ATTR}="${line}"`;
  element.outerHTML = `<div ${lineAttrs}>${svg}</div>`;
}

function isHTMLOnlyCommentsAndWhitespaces(htmlString: string): boolean {
  const fragment = document.createRange().createContextualFragment(htmlString);
  const nodes = Array.from(fragment.childNodes);
  if (nodes.length === 0) {
    return false;
  }
  return nodes.every((node) => {
    if (node.nodeType === Node.COMMENT_NODE) {
      return true;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? '').trim() === '';
    }
    return false;
  });
}

/**
 * Returns the distances from the top of the `documentElement` to the
 * top and bottom borders of the element.
 *
 * This effectively provides the absolute vertical coordinates of the
 * element.
 */
function getElementTopBottomRelativeToPage(element: Element): [number, number] {
  const rect = element.getBoundingClientRect();
  return [rect.top + window.scrollY, rect.bottom + window.scrollY];
}

fetch(INIT_URL)
  .then((response) => response.json())
  .then((params: InitalizationParams) => {
    if (params.customCSS) {
      document.head.insertAdjacentHTML(
        'afterbegin',
        `<style>${params.customCSS}</style>`
      );
    }
    if (params.config.markdown.math) {
      document.head.insertAdjacentHTML(
        'afterbegin',
        '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.4/dist/katex.min.css" integrity="sha384-u1zONI5gPXUx0UKI62c75/zww972y0v2rSK5ZYlVdS6xEuWDeZWUI66v6t1gvlXJ" crossorigin="anonymous" />'
      );
    }
    if (params.config.markdown.mermaid || params.config.rmarkdown.mermaid) {
      mermaid.initialize(params.config.mermaid.options);
    }
    return params;
  })
  .then(({ config }) => {
    const registry: ServerMessageRegistry = {
      render(message) {
        app.style.minHeight = `${app.offsetHeight}px`;
        if (!isHTMLOnlyCommentsAndWhitespaces(message.html)) {
          app.innerHTML = message.html;
        }

        document.querySelectorAll('img').forEach((img) => {
          img.addEventListener('click', () => {
            if (!document.fullscreenElement) {
              img.requestFullscreen().catch((err) => {
                console.error(
                  `Error attempting to enable full-screen mode: ${err.message}`
                );
              });
            } else {
              document.exitFullscreen();
            }
          });
        });

        if (config.markdown.mermaid || config.rmarkdown.mermaid) {
          for (const element of document.querySelectorAll(
            `.${config.mermaid.class}`
          )) {
            mermaidRender(element);
          }
        }
      },

      scroll({ line, maxLine }) {
        let sup: Element | undefined, supEnd: number | undefined;
        let inf: Element | undefined;
        let perfect: Element | undefined;
        let ratio = 0;

        for (const element of app.querySelectorAll(
          `[${LINE_BEGIN_ATTR}][${LINE_END_ATTR}]`
        )) {
          const beg = parseInt(element.getAttribute(LINE_BEGIN_ATTR)!, 10);
          const end = parseInt(element.getAttribute(LINE_END_ATTR)!, 10);
          if (beg <= line && line <= end) {
            perfect = element;
            ratio =
              end - beg < config.scroll.threshold
                ? 0
                : (line - beg) / (end - beg);
            break;
          }
          if (beg <= line) {
            sup = element;
            supEnd = end;
          } else {
            inf = element;
            supEnd = supEnd ?? 0;
            ratio =
              beg - supEnd < config.scroll.threshold
                ? 0
                : (line - supEnd) / (beg - supEnd);
            break;
          }
          if (inf === undefined) {
            ratio =
              maxLine - supEnd < config.scroll.threshold
                ? 0
                : (line - supEnd) / (maxLine - supEnd);
          }
        }

        if (perfect) {
          const [top, btm] = getElementTopBottomRelativeToPage(perfect);
          window.scrollTo({
            top: top + (btm - top) * (ratio + config.scroll.top),
            behavior: 'smooth',
          });
          return;
        }

        if (inf) {
          const btm = sup ? getElementTopBottomRelativeToPage(sup)[1] : 0;
          const [top, _] = getElementTopBottomRelativeToPage(inf);
          window.scrollTo({
            top: btm + (top - btm) * (ratio + config.scroll.top),
            behavior: 'smooth',
          });
          return;
        }

        if (!inf && sup) {
          const [_, btm] = getElementTopBottomRelativeToPage(sup);
          window.scrollTo({
            top:
              btm +
              (document.documentElement.scrollHeight - btm) *
                (ratio + config.scroll.top),
            behavior: 'smooth',
          });
          return;
        }
      },
    };

    const source = new EventSource(SSE_URL);
    source.onerror = (event) => {
      console.error(event);
      source.close();
    };
    source.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      const handler = registry[message.method];
      if (handler === undefined) {
        throw new Error(`No handler registered for method: ${message.method}`);
      }
      (handler as (message: ServerMessage) => void)(message);
    };
  });
