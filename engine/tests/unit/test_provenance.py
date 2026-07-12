from aquanavai.provenance import sha256_file, write_json


def test_json_writer_is_deterministic(tmp_path) -> None:
    left = tmp_path / "left.json"
    right = tmp_path / "right.json"
    value = {"b": 2, "a": 1}
    write_json(left, value)
    write_json(right, value)
    assert sha256_file(left) == sha256_file(right)
