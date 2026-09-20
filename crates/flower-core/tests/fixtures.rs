use flower_core::catalog::*;
use std::path::{Path, PathBuf};

fn fixtures_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests").join("fixtures")
}

fn fixture_paths() -> Vec<PathBuf> {
    let mut paths: Vec<PathBuf> = std::fs::read_dir(fixtures_dir())
        .expect("tests/fixtures directory exists")
        .map(|entry| entry.expect("readable directory entry").path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "yaml"))
        .collect();
    paths.sort();
    paths
}

fn parse(path: &Path) -> FlowerSpec {
    let text = std::fs::read_to_string(path).expect("fixture is readable");
    serde_yaml::from_str(&text)
        .unwrap_or_else(|e| panic!("{} did not parse as FlowerSpec: {e}", path.display()))
}

#[test]
fn every_fixture_parses_and_round_trips() {
    let paths = fixture_paths();
    assert!(!paths.is_empty(), "no *.yaml fixtures found in {}", fixtures_dir().display());

    paths.iter().for_each(|path| {
        let spec = parse(path);
        let first = serde_yaml::to_string(&spec).expect("spec serializes");
        let reparsed: FlowerSpec = serde_yaml::from_str(&first)
            .unwrap_or_else(|e| panic!("{} serialized form did not parse back: {e}", path.display()));
        let second = serde_yaml::to_string(&reparsed).expect("reparsed spec serializes");
        assert_eq!(first, second, "{} changed across a round trip", path.display());
    });
}

#[test]
fn contract_smoke_sets_every_new_field_away_from_its_default() {
    let spec = parse(&fixtures_dir().join("contract-smoke.yaml"));
    let defaults = FlowerSpec::default();

    assert!(matches!(spec.taxonomy.family, FlowerFamily::Iridaceae), "{:?}", spec.taxonomy.family);

    let layer = spec.petals.layers.first().expect("outer petal layer");
    assert!(!matches!(layer.pattern.kind, PatternKind::None));
    let pattern_defaults = PetalPattern::default();
    assert_ne!(layer.pattern.scale, pattern_defaults.scale);
    assert_ne!(layer.pattern.density, pattern_defaults.density);
    assert_ne!(layer.pattern.extent, pattern_defaults.extent);
    assert!(!matches!(layer.fusion.kind, FusionKind::Free));
    assert_ne!(layer.fusion.depth, Fusion::default().depth);

    assert!(!matches!(spec.petals.symmetry, Symmetry::Radial));
    assert_ne!(spec.petals.symmetry_order, defaults.petals.symmetry_order);
    assert_ne!(spec.petals.divergence_angle, defaults.petals.divergence_angle);
    assert!(!matches!(spec.petals.stage, LifeStage::Bloom));

    assert!(!matches!(spec.inflorescence.kind, InflorescenceKind::Solitary));
    assert_ne!(spec.inflorescence.head_count, defaults.inflorescence.head_count);
    assert_ne!(spec.inflorescence.head_scale, defaults.inflorescence.head_scale);
    assert_ne!(spec.inflorescence.spread, defaults.inflorescence.spread);

    let bud = spec.structure.buds.first().expect("one side bud");
    let bud_defaults = Bud::default();
    assert_ne!(bud.position, bud_defaults.position);
    assert!(matches!(bud.side, Side::Right));
    assert_ne!(bud.size, bud_defaults.size);
    assert_ne!(bud.openness, bud_defaults.openness);

    let leaf = spec.foliage.leaves.first().expect("one leaf");
    let leaf_defaults = Leaf::default();
    assert_ne!(leaf.position, leaf_defaults.position);
    assert!(matches!(leaf.side, Side::Right));
    assert_ne!(leaf.angle_offset, leaf_defaults.angle_offset);
    assert!(!matches!(leaf.variegation.kind, VariegationKind::None));
}
