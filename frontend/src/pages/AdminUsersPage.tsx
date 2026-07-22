import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { Pagination } from "../components/ui/pagination";

interface User {
  id: string;
  phone: string;
  fullName: string;
  country: string;
  kycStatus: "pending" | "verified" | "rejected";
  createdAt: string;
}

export function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kycFilter, setKycFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const fetchUsers = async (p: number) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: p.toString(),
        ...(search && { search }),
        ...(kycFilter && { kycStatus: kycFilter }),
      });

      const res = await api.get(`/api/admin/users?${params}`);
      setUsers(res.data.data);
      setTotal(res.data.total);
      setPage(p);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1);
  }, [search, kycFilter]);

  const handleViewUser = (userId: string) => {
    navigate(`/admin/users/${userId}`);
  };

  const kycStatusColors = {
    pending: "bg-amber-50 text-amber-700",
    verified: "bg-green-50 text-green-700",
    rejected: "bg-red-50 text-red-700",
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => navigate("/admin")}
          className="mb-6 flex items-center gap-2 text-ink-600 transition hover:text-ink-900"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

        <h1 className="text-3xl font-bold mb-6">Users</h1>

        <div className="mb-6 flex flex-col gap-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-3 text-ink-400" />
            <input
              type="text"
              placeholder="Search by phone or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setKycFilter("")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                !kycFilter
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border hover:bg-ink-50"
              }`}
            >
              All
            </button>
            {["pending", "verified", "rejected"].map((status) => (
              <button
                key={status}
                onClick={() => setKycFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium capitalize transition ${
                  kycFilter === status
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border hover:bg-ink-50"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-ink-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-ink-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-ink-900">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-ink-900">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-ink-900">
                    Country
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-ink-900">
                    KYC Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-ink-900">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-ink-900">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border/50 hover:bg-ink-50/50 transition cursor-pointer"
                    onClick={() => handleViewUser(user.id)}
                  >
                    <td className="px-6 py-4 text-sm text-ink-900 font-medium">
                      {user.phone}
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-700">
                      {user.fullName}
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-700">
                      {user.country}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          kycStatusColors[user.kycStatus]
                        }`}
                      >
                        {user.kycStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-700">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button className="text-primary font-medium hover:underline">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && users.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-ink-600">No users found</p>
          </div>
        )}

        {!loading && (
          <Pagination
            page={page}
            limit={limit}
            total={total}
            itemCount={users.length}
            onPageChange={fetchUsers}
            itemLabel="users"
          />
        )}
      </div>
    </div>
  );
}
