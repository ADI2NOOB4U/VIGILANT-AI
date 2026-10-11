"""Regression checks for provenance-first URL collection and academic URL coverage."""
import json
from pathlib import Path
from urllib.parse import urlsplit

from scripts.collect_benign_dynamic_urls import SOURCES


ROOT = Path(__file__).resolve().parents[1]


def test_collector_contains_indian_academic_seed_sources():
    sources = {item["name"]: item for item in SOURCES}
    expected = {
        "VIT Bhopal University": "vitbhopal.ac.in",
        "VIT Bhopal VTOP Portal": "vtop.vitbhopal.ac.in",
        "Indian Institute of Technology Delhi": "home.iitd.ac.in",
        "Indian Institute of Science": "www.iisc.ac.in",
        "Indian Institute of Technology Madras": "www.iitm.ac.in",
        "Indian Institute of Technology Kanpur": "www.iitk.ac.in",
        "Indian Institute of Technology Kharagpur": "www.iitkgp.ac.in",
        "Indian Institute of Technology Hyderabad": "www.iith.ac.in",
        "National Institute of Technology Tiruchirappalli": "www.nitt.edu",
        "International Institute of Information Technology Hyderabad": "www.iiit.ac.in",
    }
    for name, expected_host in expected.items():
        assert name in sources
        parsed = urlsplit(sources[name]["url"])
        assert parsed.scheme == "https"
        assert parsed.hostname == expected_host
        assert sources[name]["why_legitimate"]


def test_collector_seeds_are_unique_https_urls():
    urls = [item["url"] for item in SOURCES]
    assert all(urlsplit(url).scheme == "https" for url in urls)
    assert len(urls) == len(set(urls))
    names = [item["name"] for item in SOURCES]
    assert len(names) == len(set(names))


def test_fixed_legitimate_benchmark_covers_vtop_and_indian_institutions():
    path = ROOT / "experiments" / "auto_ml" / "benchmark_v1" / "fixed_urls.json"
    benchmark = json.loads(path.read_text(encoding="utf-8"))
    urls = set(benchmark["baseline_legitimate_urls"])
    expected = {
        "https://vitbhopal.ac.in/",
        "https://vtop.vitbhopal.ac.in/vtop",
        "https://vtop.vitbhopal.ac.in/vtop/login",
        "https://vtop.vitbhopal.ac.in/vtop/open/page",
        "https://vtop.vitbhopal.ac.in/vtop/prelogin/setup",
        "https://home.iitd.ac.in/",
        "https://www.iisc.ac.in/web/",
        "https://www.iitm.ac.in/",
        "https://www.iitk.ac.in/",
        "https://www.iitkgp.ac.in/",
        "https://www.iith.ac.in/",
        "https://www.nitt.edu/",
        "https://www.iiit.ac.in/",
    }
    assert expected <= urls
    assert len(urls) == len(benchmark["baseline_legitimate_urls"])
