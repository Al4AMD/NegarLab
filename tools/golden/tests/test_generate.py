import json

from negarlab_golden.generate import build_vectors, write_vectors


def test_vectors_are_deterministic(tmp_path):
    first = tmp_path / "a.json"
    second = tmp_path / "b.json"
    write_vectors(first)
    write_vectors(second)
    assert first.read_bytes() == second.read_bytes()


def test_vector_structure():
    data = build_vectors()
    assert data["input"]["width"] == 8
    assert data["input"]["height"] == 8
    assert len(data["input"]["rgba"]) == 8 * 8 * 4
    assert len(data["expected"]["luma"]) == 8 * 8
    assert data["tolerance"] == 1e-6
    assert 0.0 <= data["expected"]["stats"]["mean"] <= 1.0
    assert data["expected"]["stats"]["entropyBits"] > 0


def test_committed_fixture_matches_generator(tmp_path):
    from negarlab_golden.generate import DEFAULT_OUT

    assert DEFAULT_OUT.exists(), "run pnpm gen:golden"
    regenerated = tmp_path / "luma-stats.json"
    write_vectors(regenerated)
    assert json.loads(regenerated.read_text()) == json.loads(DEFAULT_OUT.read_text())
