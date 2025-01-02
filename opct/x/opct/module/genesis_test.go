package opct_test

import (
	"testing"

	keepertest "opct/testutil/keeper"
	"opct/testutil/nullify"
	opct "opct/x/opct/module"
	"opct/x/opct/types"

	"github.com/stretchr/testify/require"
)

func TestGenesis(t *testing.T) {
	genesisState := types.GenesisState{
		Params: types.DefaultParams(),

		// this line is used by starport scaffolding # genesis/test/state
	}

	k, ctx := keepertest.OpctKeeper(t)
	opct.InitGenesis(ctx, k, genesisState)
	got := opct.ExportGenesis(ctx, k)
	require.NotNil(t, got)

	nullify.Fill(&genesisState)
	nullify.Fill(got)

	// this line is used by starport scaffolding # genesis/test/assert
}
