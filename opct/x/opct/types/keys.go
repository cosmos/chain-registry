package types

const (
	// ModuleName defines the module name
	ModuleName = "opct"

	// StoreKey defines the primary module store key
	StoreKey = ModuleName

	// MemStoreKey defines the in-memory store key
	MemStoreKey = "mem_opct"
)

var (
	ParamsKey = []byte("p_opct")
)

func KeyPrefix(p string) []byte {
	return []byte(p)
}
