package keeper_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	keepertest "opct/testutil/keeper"
	"opct/x/opct/types"
)

func TestGetParams(t *testing.T) {
	k, ctx := keepertest.OpctKeeper(t)
	params := types.DefaultParams()

	require.NoError(t, k.SetParams(ctx, params))
	require.EqualValues(t, params, k.GetParams(ctx))
}
