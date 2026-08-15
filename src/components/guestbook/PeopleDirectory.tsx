import React, { useState } from "react";
import { Loader2, Users } from "lucide-react";
import { SearchField } from "@/components/common";
import { SEOHead } from "@/components/seo/SEOHead";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useRecentMembers, useUserSearch } from "@/hooks/queries/usePeopleQueries";
import { useAuthContext } from "@/contexts/AuthContext";
import PersonRow from "./PersonRow";
import GuestbookTabs from "./GuestbookTabs";

const PeopleDirectory: React.FC = () => {
  const { user } = useAuthContext();
  const [term, setTerm] = useState("");
  const debouncedTerm = useDebouncedValue(term, 250);

  const searching = debouncedTerm.trim().length > 0;
  const search = useUserSearch(debouncedTerm);
  const recent = useRecentMembers();

  const active = searching ? search : recent;
  // Exclude yourself: you cannot follow yourself and your own profile is a click
  // away in the navbar.
  const people = (active.data ?? []).filter((p) => p.uid !== user?.uid);

  // Typing has registered but the debounced query has not fired yet — without
  // this the previous result set looks like the answer to the new term.
  const settling = searching && term.trim() !== debouncedTerm.trim();
  const isLoading = active.isLoading || settling;

  if (!user) {
    return (
      <div className="container mx-auto px-4 max-w-3xl text-center py-16">
        <Users className="w-10 h-10 mx-auto mb-4 text-ns-ink-muted opacity-40" />
        <p className="font-heading text-title font-light text-ns-ink-muted mb-1">
          Sign in to find people
        </p>
        <p className="font-ui text-sm text-ns-ink-muted">
          The member directory is only visible to signed-in members.
        </p>
      </div>
    );
  }

  return (
    // A directory is a single column of rows; max-w-7xl would strand the follow
    // buttons far from the names they belong to.
    <div className="container mx-auto px-4 max-w-3xl py-8">
      <SEOHead title="People" noindex />

      <h1 className="font-heading text-3xl sm:text-4xl text-ns-ink leading-none mb-6">
        People
      </h1>

      <GuestbookTabs active="people" wallUserId={user.uid} />

      <header className="mb-5">
        <SearchField
          value={term}
          onChange={setTerm}
          placeholder="Search by username…"
          ariaLabel="Search people by username"
        />
      </header>

      {!searching && !recent.isLoading && people.length > 0 && (
        <h2 className="font-ui text-[11px] tracking-[1.5px] uppercase text-ns-ink-muted mb-1">
          Newest members
        </h2>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-ns-accent" size={28} />
        </div>
      ) : active.isError ? (
        <p className="py-16 text-center font-ui text-sm text-ns-destructive">
          Could not load members. Please refresh and try again.
        </p>
      ) : people.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-10 h-10 mx-auto mb-4 text-ns-ink-muted opacity-40" />
          <p className="font-heading text-title font-light text-ns-ink-muted mb-1">
            {searching ? "No one by that name" : "No members to show yet"}
          </p>
          {searching && (
            <p className="font-ui text-sm text-ns-ink-muted">
              Usernames match from the start, so try the first few letters.
            </p>
          )}
        </div>
      ) : (
        <ul className="list-none p-0 m-0">
          {people.map((person) => (
            <PersonRow key={person.uid} person={person} />
          ))}
        </ul>
      )}
    </div>
  );
};

export default PeopleDirectory;
