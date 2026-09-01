const UPDATED = 'August 31, 2026';

export function Privacy() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
      <div className="mb-8">
        <div className="font-display text-lg font-black tracking-tight">Triple Jeopardy</div>
        <div className="dateline mt-1">Positive Force</div>
      </div>

      <h1 className="text-2xl font-black tracking-tight">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated {UPDATED}</p>

      <p>
        Triple Jeopardy is a social-media publishing tool operated by Positive Force. It is used by
        political consultants and campaign staff to draft, review, schedule, and publish posts to
        social networks on behalf of a campaign. This policy explains what data the service handles
        and why.
      </p>

      <h2>Who uses the service</h2>
      <p>
        Accounts are created by an administrator for consultants and campaign staff. Candidates and
        designated approvers review content through single-use links and are not required to create
        an account.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account information</strong> — the email address and password of each operator who
          signs in.
        </li>
        <li>
          <strong>Connected social accounts</strong> — when you connect a Facebook Page, Instagram
          account, Threads profile, Bluesky account, or similar, we store the account identifier,
          handle, and an access credential (an OAuth token or app password). Credentials are
          encrypted at rest and are used only to publish the content you schedule.
        </li>
        <li>
          <strong>Content</strong> — the text, images, and scheduling information for the posts you
          create, and the approval decisions and notes recorded against them.
        </li>
        <li>
          <strong>Campaign information</strong> — the campaign or race name, jurisdiction, committee
          name and disclaimer text you enter.
        </li>
        <li>
          <strong>Metrics</strong> — where a connected network provides them, engagement and reach
          figures for posts published through the service.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To publish the posts you schedule to the networks you have connected.</li>
        <li>To show you the status of scheduled and published posts and their metrics.</li>
        <li>To operate the approval workflow — generating review links and recording decisions.</li>
        <li>To keep an internal record of what was published and approved, and when.</li>
      </ul>
      <p>We do not sell personal data, and we do not use it for advertising.</p>

      <h2>Sharing</h2>
      <p>
        Post content and media are sent to the social networks you connect (for example Meta&rsquo;s
        Graph API for Facebook and Instagram, the Threads API, or the Bluesky/AT Protocol servers)
        for the sole purpose of publishing. The service runs on Supabase (database, authentication,
        file storage) and Cloudflare (hosting and scheduled publishing); these providers process
        data on our behalf under their own terms. We disclose data if required by law.
      </p>

      <h2>Retention</h2>
      <p>
        Content and connection records are retained while your workspace is active. Deleting a
        campaign or workspace removes its posts, media, and connected-account records. The record of
        approval decisions is retained as a compliance history for the campaign.
      </p>

      <h2>Deleting your data</h2>
      <p>
        To disconnect a social account, use the <strong>Accounts</strong> screen in the app — this
        deletes the stored credential immediately. To delete a campaign or an entire workspace and
        everything in it, use <strong>Settings</strong>. To request deletion of any remaining data,
        email <a className="text-[color:var(--pf-brick)] underline underline-offset-2" href="mailto:ezra@positiveforce.win">ezra@positiveforce.win</a> and we will
        remove it within 30 days.
      </p>

      <h2>Security</h2>
      <p>
        Access credentials for connected accounts are encrypted at rest. The application is served
        over HTTPS. Access to a workspace requires signing in; each workspace&rsquo;s data is
        isolated from every other workspace.
      </p>

      <h2>Contact</h2>
      <p>
        Positive Force —{' '}
        <a className="text-[color:var(--pf-brick)] underline underline-offset-2" href="mailto:ezra@positiveforce.win">ezra@positiveforce.win</a>
      </p>
    </div>
  );
}
