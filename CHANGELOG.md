# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-02-11

### Added

- Initial release of aitelier CLI
- `ait init` - Interactive project initialization with provider selection
- `ait add` - Collect training examples interactively or from files
- `ait rate` - Review and score examples with inline rewriting
- `ait stats` - View dataset statistics and rating distribution
- `ait format` - Export examples to provider-specific JSONL format
- `ait split` - Create train/validation splits with stratification
- `ait train` - Submit fine-tuning jobs to Together.ai
- `ait status` - Monitor fine-tuning job progress
- `ait eval` - Evaluate fine-tuned models on validation set
- `ait eval --compare` - Blind A/B testing between base and fine-tuned models
- Together.ai provider integration
- Local JSONL-based storage system
- Interactive prompts with Inquirer.js
- Comprehensive test coverage with Vitest
- Example projects for customer support and code review use cases

### Features

- Vendor-agnostic provider interface
- Quality threshold filtering
- Locked validation sets to prevent data leakage
- Detailed evaluation results with JSON export
- Rating-based stratification for splits
- Configurable fine-tuning hyperparameters
- Interactive CLI with clear formatting

[Unreleased]: https://github.com/furkantanyol/aitelier/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/furkantanyol/aitelier/releases/tag/v0.1.0
