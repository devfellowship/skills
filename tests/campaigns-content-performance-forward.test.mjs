import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const fixture = JSON.parse(
	readFileSync(
		new URL("fixtures/campaigns-content-performance-forward.json", import.meta.url),
		"utf8",
	),
);

const platforms = new Set([
	"instagram",
	"facebook",
	"linkedin",
	"tiktok",
	"youtube",
	"x",
	"threads",
	"pinterest",
	"reddit",
	"bluesky",
	"telegram",
	"discord",
	"whatsapp",
	"google_business",
]);
const metrics = new Set(["views", "likes", "comments", "engagement"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function exactKeys(value, keys, label) {
	assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label} fields changed`);
}

function call(scenario, name) {
	const calls = scenario.tool_trace.filter((entry) => entry.name === name);
	assert.ok(calls.length > 0, `${scenario.name} must call ${name}`);
	return calls;
}

function optionalCalls(scenario, name) {
	return scenario.tool_trace.filter((entry) => entry.name === name);
}

function rankingRows(scenario) {
	return call(scenario, "rank_account_posts").flatMap((entry) => entry.output.posts);
}

test("the fixture uses the exact Campaigns analytics MCP contract", () => {
	for (const scenario of fixture.scenarios) {
		const connectedAccounts = [];
		for (const entry of call(scenario, "list_zernio_accounts")) {
			exactKeys(entry.input, [], "Zernio account input");
			exactKeys(entry.output, ["accounts", "next_step"], "Zernio account output");
			assert.equal(typeof entry.output.next_step, "string");
			for (const account of entry.output.accounts) {
				exactKeys(account, ["id", "platform", "label"], "Zernio account");
				assert.ok(platforms.has(account.platform));
				connectedAccounts.push(account);
			}
		}

		const accountPairs = new Set();
		for (const entry of call(scenario, "list_campaign_accounts")) {
			exactKeys(entry.input, entry.input.platform ? ["platform"] : [], "list input");
			exactKeys(entry.output, ["accounts"], "list output");
			for (const account of entry.output.accounts) {
				exactKeys(
					account,
					["account_id", "platform", "post_count", "first_snapshot_date", "last_snapshot_date"],
					"account",
				);
				assert.ok(platforms.has(account.platform));
				accountPairs.add(`${account.account_id}\0${account.platform}`);
			}
		}
		const candidates = connectedAccounts.filter(
			(account) =>
				account.label === scenario.target_account_label &&
				accountPairs.has(`${account.id}\0${account.platform}`),
		);
		if (candidates.length !== 1) {
			assert.equal(scenario.report.account_resolution.status, "ambiguous");
			assert.deepEqual(
				scenario.report.account_resolution.candidates,
				candidates.map(({ id, platform, label }) => ({ id, platform, label })),
			);
			assert.match(scenario.report.account_resolution.question, /exact account id/i);
			assert.equal(optionalCalls(scenario, "rank_account_posts").length, 0);
			assert.equal(optionalCalls(scenario, "get_post_metric_history").length, 0);
			continue;
		}
		assert.equal(scenario.report.account_resolution.status, "resolved");
		assert.equal(scenario.report.account_resolution.account_id, candidates[0].id);
		assert.equal(scenario.report.account_resolution.platform, candidates[0].platform);

		for (const entry of call(scenario, "rank_account_posts")) {
			const expectedInput = ["account_id", "platform", "metric", "basis", "limit"];
			if (entry.input.basis === "period_gain") {
				expectedInput.push("start_date", "end_date");
			}
			exactKeys(entry.input, expectedInput, "ranking input");
			assert.ok(accountPairs.has(`${entry.input.account_id}\0${entry.input.platform}`));
			assert.equal(entry.input.account_id, candidates[0].id);
			assert.equal(entry.input.platform, candidates[0].platform);
			assert.ok(metrics.has(entry.input.metric));
			assert.ok(["lifetime", "period_gain"].includes(entry.input.basis));
			exactKeys(
				entry.output,
				["account_id", "platform", "metric", "basis", "period", "posts", "count", "coverage_warning"],
				"ranking output",
			);
			assert.equal(entry.output.account_id, entry.input.account_id);
			assert.equal(entry.output.platform, entry.input.platform);
			assert.equal(entry.output.metric, entry.input.metric);
			assert.equal(entry.output.basis, entry.input.basis);
			assert.equal(entry.output.count, entry.output.posts.length);
			assert.ok(Number.isInteger(entry.input.limit));
			assert.ok(entry.input.limit > 0 && entry.input.limit <= 100);
			if (entry.input.basis === "period_gain") {
				exactKeys(entry.output.period, ["start_date", "end_date"], "ranking period");
				assert.equal(entry.output.period.start_date, entry.input.start_date);
				assert.equal(entry.output.period.end_date, entry.input.end_date);
			} else {
				assert.equal(entry.output.period, null);
			}

			for (const post of entry.output.posts) {
				exactKeys(
					post,
					[
						"rank",
						"post_id",
						"zernio_post_id",
						"platform",
						"account_id",
						"platform_post_id",
						"title",
						"content_excerpt",
						"published_at",
						"metric",
						"basis",
						"value",
						"latest_absolute",
						"baseline_absolute",
						"coverage_status",
						"snapshot_coverage",
					],
					"ranking post",
				);
				assert.match(post.post_id, uuid);
				assert.equal(post.account_id, entry.input.account_id);
				assert.equal(post.platform, entry.input.platform);
				assert.equal(post.metric, entry.input.metric);
				assert.equal(post.basis, entry.input.basis);
				exactKeys(
					post.snapshot_coverage,
					["first_snapshot_date", "last_snapshot_date", "snapshot_count", "baseline_date", "latest_date"],
					"snapshot coverage",
				);
			}
		}

		const rows = rankingRows(scenario);
		for (const entry of call(scenario, "get_post_metric_history")) {
			exactKeys(
				entry.input,
				["post_id", "account_id", "platform", "start_date", "end_date"],
				"history input",
			);
			assert.match(entry.input.post_id, uuid);
			assert.ok(
				rows.some(
					(row) =>
						row.post_id === entry.input.post_id &&
						row.account_id === entry.input.account_id &&
						row.platform === entry.input.platform,
				),
				"history filters must come from one ranking row",
			);
			exactKeys(entry.output, ["post", "history", "count"], "history output");
			exactKeys(
				entry.output.post,
				["post_id", "zernio_post_id", "title", "content_excerpt", "published_at"],
				"history post",
			);
			assert.equal(entry.output.post.post_id, entry.input.post_id);
			assert.equal(entry.output.count, entry.output.history.length);
			for (const point of entry.output.history) {
				exactKeys(
					point,
					[
						"platform",
						"account_id",
						"platform_post_id",
						"collected_for",
						"collected_at",
						"source_updated_at",
						"views",
						"likes",
						"comments",
						"shares",
						"saves",
					],
					"history point",
				);
				assert.equal(point.account_id, entry.input.account_id);
				assert.equal(point.platform, entry.input.platform);
			}
		}
	}
});

test("the weekly forward report preserves coverage and platform boundaries", () => {
	const scenario = fixture.scenarios.find((entry) => entry.name === "weekly-period-gain");
	assert.equal(scenario.report.basis, "period_gain");
	assert.ok(scenario.report.results.length > 0);
	assert.equal(
		new Set(scenario.report.results.map((entry) => `${entry.account_id}\0${entry.platform}`)).size,
		scenario.report.results.length,
	);
	assert.equal(scenario.report.cross_platform_comparison, null);
	assert.match(scenario.report.platform_caveat, /separate/i);

	const rows = rankingRows(scenario);
	for (const result of scenario.report.results) {
		const winner = rows.find(
			(row) =>
				row.post_id === result.winner.post_id &&
				row.account_id === result.account_id &&
				row.platform === result.platform,
		);
		assert.ok(winner, "each winner must belong to its account and platform result");
		assert.equal(winner.coverage_status, "complete");
		assert.equal(result.winner.value, winner.value);
		assert.equal(result.winner.value_label, "period gain");
	}

	const incomplete = rows.filter((row) => row.coverage_status !== "complete");
	assert.deepEqual(
		scenario.report.coverage_caveats.map((entry) => entry.post_id).sort(),
		incomplete.map((entry) => entry.post_id).sort(),
	);
	for (const caveat of scenario.report.coverage_caveats) {
		assert.match(caveat.message, /baseline/i);
		assert.match(caveat.message, /lifetime total/i);
		assert.match(caveat.message, /not a weekly gain/i);
	}

	for (const pattern of scenario.report.repeatable_patterns) {
		assert.ok(pattern.evidence_post_ids.length >= 2);
		assert.equal(pattern.causal_claim, false);
	}
	for (const action of scenario.report.next_actions) {
		assert.ok(platforms.has(action.platform));
		assert.ok(metrics.has(action.metric));
		assert.ok(action.evaluation_window_days > 0);
	}
});

test("the retrospective forward report labels absolute values as lifetime totals", () => {
	const scenario = fixture.scenarios.find((entry) => entry.name === "first-retrospective");
	assert.equal(scenario.report.basis, "lifetime");
	for (const result of scenario.report.results) {
		assert.equal(result.winner.value_label, "lifetime total");
		assert.doesNotMatch(result.winner.summary, /weekly gain/i);
	}
});

test("same-platform account ambiguity stops before ranking", () => {
	const scenario = fixture.scenarios.find((entry) => entry.name === "same-platform-ambiguity");
	assert.ok(scenario, "the forward fixture must include a same-platform ambiguity");
	assert.equal(scenario.report.account_resolution.status, "ambiguous");
	assert.equal(optionalCalls(scenario, "rank_account_posts").length, 0);
	assert.equal(optionalCalls(scenario, "get_post_metric_history").length, 0);
});
