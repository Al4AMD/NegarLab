from pathlib import Path

from PIL import Image

import generate


def test_demo_images_are_deterministic(tmp_path: Path) -> None:
    first_dir = tmp_path / "first"
    second_dir = tmp_path / "second"

    first = generate.generate_all(first_dir)
    second = generate.generate_all(second_dir)

    assert first == second
    assert len(first) == 4
    for name in first:
        assert (first_dir / name).read_bytes() == (second_dir / name).read_bytes()
        with Image.open(first_dir / name) as image:
            assert image.size == (generate.SIZE, generate.SIZE)
            assert image.mode == "RGB"
