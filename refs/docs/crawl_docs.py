"""
Crawl ALL pages from hub.evenrealities.com/docs using Playwright.
Saves each page as both .md (markdown via markdownify) and .html.
"""

import asyncio
import re
import sys
import json
from pathlib import Path
from urllib.parse import urljoin, urlparse

from playwright.async_api import async_playwright

try:
    from markdownify import markdownify as md
except ImportError:
    md = None

BASE = "https://hub.evenrealities.com"
START = f"{BASE}/docs/getting-started/overview"
OUT = Path(__file__).parent / "pages"
OUT.mkdir(exist_ok=True)

VISITED: set[str] = set()
QUEUE: list[str] = []

def url_to_filename(url: str) -> str:
    path = urlparse(url).path.strip("/").replace("/", "__")
    return path or "index"

def is_docs_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.netloc in ("hub.evenrealities.com", "") and parsed.path.startswith("/docs")

async def extract_links(page) -> list[str]:
    links = await page.eval_on_selector_all("a[href]", "els => els.map(e => e.href)")
    return [l for l in links if is_docs_url(l)]

async def wait_for_content(page):
    # Wait for the main content area to hydrate (Nuxt CSR)
    try:
        await page.wait_for_selector("article, main, .content, [class*='content'], h1", timeout=15000)
    except Exception:
        pass
    await page.wait_for_load_state("networkidle", timeout=20000)

async def scrape_page(browser, url: str) -> list[str]:
    page = await browser.new_page()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await wait_for_content(page)

        title = await page.title()
        html_content = await page.content()

        # Extract meaningful body content
        body_html = await page.eval_on_selector(
            "article, main, [class*='doc'], [class*='content'], body",
            "el => el.innerHTML"
        ) if await page.query_selector("article, main, [class*='doc'], [class*='content']") else html_content

        fname = url_to_filename(url)
        (OUT / f"{fname}.html").write_text(html_content, encoding="utf-8")

        if md:
            markdown = f"# {title}\n\nSource: {url}\n\n" + md(body_html, heading_style="ATX")
            (OUT / f"{fname}.md").write_text(markdown, encoding="utf-8")

        print(f"  ✓ {url}")

        new_links = await extract_links(page)
        return new_links
    except Exception as e:
        print(f"  ✗ {url}: {e}")
        return []
    finally:
        await page.close()

async def discover_from_nav(browser) -> list[str]:
    """Load the start page and extract all sidebar nav links at once."""
    page = await browser.new_page()
    urls = []
    try:
        await page.goto(START, wait_until="domcontentloaded", timeout=30000)
        await wait_for_content(page)

        # Try to find all nav links in sidebar / table of contents
        all_links = await page.eval_on_selector_all(
            "nav a[href], aside a[href], [class*='sidebar'] a[href], [class*='nav'] a[href], [class*='toc'] a[href]",
            "els => els.map(e => e.href)"
        )
        urls = [l for l in all_links if is_docs_url(l)]
        print(f"Nav discovery found {len(urls)} links")
    except Exception as e:
        print(f"Nav discovery error: {e}")
    finally:
        await page.close()
    return urls

async def main():
    sys.stdout.reconfigure(encoding="utf-8")
    print(f"Starting crawl of {BASE}/docs/ ...")
    print(f"Output: {OUT}")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)

        # Phase 1: discover all nav links from sidebar
        nav_urls = await discover_from_nav(browser)
        seeds = list(set([START] + nav_urls))
        QUEUE.extend(seeds)

        # Phase 2: BFS crawl
        while QUEUE:
            url = QUEUE.pop(0)
            # Normalize: strip query/fragment, ensure absolute
            parsed = urlparse(url)
            clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            if clean in VISITED:
                continue
            VISITED.add(clean)

            new_links = await scrape_page(browser, clean)
            for link in new_links:
                p = urlparse(link)
                c = f"{p.scheme}://{p.netloc}{p.path}"
                if c not in VISITED and is_docs_url(c):
                    QUEUE.append(c)

        await browser.close()

    print(f"\nDone! Scraped {len(VISITED)} pages → {OUT}")
    # Write index
    index = sorted(VISITED)
    (OUT.parent / "pages_index.txt").write_text("\n".join(index), encoding="utf-8")
    print(f"Index written to pages_index.txt")

if __name__ == "__main__":
    asyncio.run(main())
