import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Ban, Search, Shield } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { adminRoleService } from "@/cloudFunctions/adminRoles";
import { Helmet } from "react-helmet-async";
import { useAuthContext } from "@/contexts/AuthContext";
import { profilePath } from "@/lib/seoPaths";
import {
  adminMemberService,
  type AdminMember,
} from "@/services/AdminMemberService";
import { InviteRequests } from "./InviteRequests";
import { McpAccessRequests } from "./McpAccessRequests";
import { BanDialog } from "./BanDialog";

const control =
  "rounded-ns border border-ns-border bg-ns-elevated px-3 py-2 text-sm text-ns-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent disabled:opacity-50";

type RoleChange = { member: AdminMember; admin: boolean };
type BanChange = { member: AdminMember; banned: boolean };

function MemberRow({
  member,
  isAdmin,
  isBanned,
  isSelf,
  onChangeRole,
  onChangeBan,
}: {
  member: AdminMember;
  isAdmin: boolean | undefined;
  isBanned: boolean | undefined;
  isSelf: boolean;
  onChangeRole: (change: RoleChange) => void;
  onChangeBan: (change: BanChange) => void;
}) {
  const name = `${member.firstName} ${member.lastName}`.trim();
  return (
    <tr className="border-b border-ns-border hover:bg-ns-surface">
      <td className="py-5 pr-6">
        <Link
          to={profilePath(member.userId)}
          className="font-semibold underline-offset-4 hover:text-ns-accent hover:underline"
        >
          @{member.username}
        </Link>
      </td>
      <td className="py-5 pr-6 text-ns-ink-secondary">{name || "Not set"}</td>
      <td className="min-w-[14rem] max-w-xs break-all py-5 pr-6 text-ns-ink-secondary select-all">
        {member.userId}
      </td>
      <td className="whitespace-nowrap py-5 pr-6">
        {new Date(member.createdAt).toLocaleDateString()}
      </td>
      <td className="whitespace-nowrap py-5">
        {member.storyCount > 0 ? (
          <Link
            to={`/admin/stories?q=${encodeURIComponent(member.userId)}`}
            className="underline-offset-4 hover:text-ns-accent hover:underline"
          >
            {member.storyCount} ({member.publishedStoryCount} published)
          </Link>
        ) : (
          <span className="text-ns-ink-secondary">None</span>
        )}
      </td>
      <td className="whitespace-nowrap py-5 pr-6">
        {isAdmin === undefined ? (
          <span className="text-ns-ink-secondary">…</span>
        ) : isAdmin ? (
          <span className="inline-flex items-center gap-1 font-semibold text-ns-gold">
            <Shield size={14} aria-hidden="true" /> Admin
          </span>
        ) : isBanned ? (
          <span className="inline-flex items-center gap-1 font-semibold text-ns-destructive">
            <Ban size={14} aria-hidden="true" /> Banned
          </span>
        ) : (
          <span className="text-ns-ink-secondary">Member</span>
        )}
      </td>
      <td className="whitespace-nowrap py-5 pr-6">
        <Link
          to={`/admin/ai-usage/users/${member.userId}`}
          className="underline-offset-4 hover:text-ns-accent hover:underline"
        >
          AI usage
        </Link>
      </td>
      <td className="whitespace-nowrap py-5">
        {isSelf ? (
          <span className="text-ns-ink-secondary">You</span>
        ) : (
          isAdmin !== undefined && (
            <span className="flex gap-2">
              {!isBanned && (
                <button
                  type="button"
                  onClick={() => onChangeRole({ member, admin: !isAdmin })}
                  className={`${control} ${isAdmin ? "text-ns-destructive" : ""}`}
                >
                  {isAdmin ? "Remove admin" : "Make admin"}
                </button>
              )}
              {/* An admin loses the role before they can be banned. */}
              {!isAdmin && (
                <button
                  type="button"
                  onClick={() => onChangeBan({ member, banned: !isBanned })}
                  className={`${control} ${isBanned ? "" : "text-ns-destructive"}`}
                >
                  {isBanned ? "Unban" : "Ban"}
                </button>
              )}
            </span>
          )
        )}
      </td>
    </tr>
  );
}

function MemberPage({
  members,
  viewerId,
  onChangeRole,
  onChangeBan,
}: {
  members: AdminMember[];
  viewerId: string;
  onChangeRole: (change: RoleChange) => void;
  onChangeBan: (change: BanChange) => void;
}) {
  const uids = members.map((member) => member.userId);
  const roles = useQuery({
    queryKey: ["admin", viewerId, "roles", uids],
    queryFn: () => adminRoleService.statuses(uids),
    enabled: uids.length > 0,
  });
  return members.map((member) => (
    <MemberRow
      key={member.userId}
      member={member}
      isAdmin={roles.data?.admins.has(member.userId)}
      isBanned={roles.data?.banned.has(member.userId)}
      isSelf={member.userId === viewerId}
      onChangeRole={onChangeRole}
      onChangeBan={onChangeBan}
    />
  ));
}

function MemberList({ viewerId }: { viewerId: string }) {
  const queryClient = useQueryClient();
  const [roleChange, setRoleChange] = useState<RoleChange | null>(null);
  const [roleError, setRoleError] = useState("");
  const [banChange, setBanChange] = useState<BanChange | null>(null);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const members = useInfiniteQuery({
    queryKey: ["admin", viewerId, "members", search],
    initialPageParam: "",
    queryFn: ({ pageParam, signal }) =>
      adminMemberService.list(search, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor,
  });
  async function changeRole() {
    if (!roleChange) return false;
    const { member, admin } = roleChange;
    try {
      await adminRoleService.setAdmin(member.userId, admin);
      await queryClient.invalidateQueries({
        queryKey: ["admin", viewerId, "roles"],
      });
      toast.success(
        admin
          ? `@${member.username} is now an admin. It applies after they next sign in.`
          : `@${member.username} is no longer an admin and has been signed out.`,
      );
      setRoleChange(null);
      return true;
    } catch (error) {
      setRoleError(
        error instanceof Error ? error.message : "Could not change the role.",
      );
      return false;
    }
  }
  function findMember(event: FormEvent) {
    event.preventDefault();
    setSearch(input.trim());
  }
  return (
    <>
      <p className="mt-3 max-w-prose text-ns-ink-secondary">
        Everyone with a profile, newest first. Story counts include drafts.
      </p>
      <form
        onSubmit={findMember}
        className="my-8 flex flex-wrap items-end gap-3"
      >
        <label className="min-w-[200px] flex-1 text-sm">
          Find a member
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={120}
            placeholder="Username, name or user ID"
            className={`${control} mt-2 block w-full`}
          />
        </label>
        <button
          className={`${control} inline-flex items-center gap-2`}
          type="submit"
        >
          <Search size={16} /> Search
        </button>
      </form>
      {members.isPending && <p role="status">Loading members…</p>}
      {members.error && (
        <div role="alert" className="my-6 text-ns-destructive">
          <p>{members.error.message}</p>
          <button
            className={`${control} mt-3`}
            onClick={() => void members.refetch()}
          >
            Try again
          </button>
        </div>
      )}
      {members.data && (
        <>
          {members.data.pages.every((page) => page.members.length === 0) ? (
            <p className="py-8 text-ns-ink-secondary">
              No members found. Try another username, name or ID.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-ns-border text-ns-ink-secondary">
                  <tr>
                    {[
                      "Username",
                      "Name",
                      "User ID",
                      "Joined",
                      "Stories",
                      "Role",
                      "AI usage",
                      "Actions",
                    ].map((label) => (
                      <th
                        key={label}
                        scope="col"
                        className="pb-3 pr-6 font-medium"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.data.pages.map((page, index) => (
                    <MemberPage
                      key={index}
                      members={page.members}
                      viewerId={viewerId}
                      onChangeRole={(change) => {
                        setRoleError("");
                        setRoleChange(change);
                      }}
                      onChangeBan={setBanChange}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {members.hasNextPage && (
            <button
              className={`${control} mt-6`}
              disabled={members.isFetchingNextPage}
              onClick={() => void members.fetchNextPage()}
            >
              {members.isFetchingNextPage ? "Loading…" : "Load more members"}
            </button>
          )}
        </>
      )}
      <ConfirmDialog
        open={roleChange !== null}
        onOpenChange={(open) => {
          if (!open) setRoleChange(null);
        }}
        title={
          roleChange?.admin
            ? `Make @${roleChange.member.username} an admin?`
            : `Remove @${roleChange?.member.username ?? ""} as admin?`
        }
        description={
          roleChange?.admin
            ? "They will be able to read every draft, delete stories and competition drafts, approve invites and change other admins. It applies after they next sign in."
            : "They lose admin access immediately and are signed out of every device."
        }
        confirmLabel={roleChange?.admin ? "Make admin" : "Remove admin"}
        variant={roleChange?.admin ? "default" : "danger"}
        onConfirm={changeRole}
      >
        {roleError && (
          <p role="alert" className="text-sm text-ns-destructive">
            {roleError}
          </p>
        )}
      </ConfirmDialog>
      <BanDialog
        change={banChange}
        viewerId={viewerId}
        onClose={() => setBanChange(null)}
      />
    </>
  );
}

export default function AdminMembers() {
  const { user } = useAuthContext();
  const [params, setParams] = useSearchParams();
  const requested = params.get("view");
  const view =
    requested === "invites" || requested === "connector"
      ? requested
      : "members";
  return (
    <>
      <Helmet>
        <title>Members | TheTaleTribe</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <h1 className="font-heading text-3xl sm:text-4xl">Members</h1>
      <div
        role="tablist"
        aria-label="Member views"
        className="mt-6 inline-flex rounded-ns border border-ns-border p-1"
      >
        {[
          { id: "members", label: "Members" },
          { id: "invites", label: "Invite requests" },
          { id: "connector", label: "Claude connector" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            onClick={() =>
              setParams(tab.id === "members" ? {} : { view: tab.id })
            }
            className={`rounded-ns px-4 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent ${view === tab.id ? "bg-ns-accent text-white" : "text-ns-ink-secondary hover:text-ns-ink"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {view === "invites" ? (
        <InviteRequests viewerId={user!.uid} />
      ) : view === "connector" ? (
        <McpAccessRequests viewerId={user!.uid} />
      ) : (
        <MemberList viewerId={user!.uid} />
      )}
    </>
  );
}
