param([string]$Root = ".")
$ErrorActionPreference = "Continue"
Set-Location $Root

function Remove-Paths([string[]]$paths) {
  foreach ($p in $paths) {
    if (Test-Path $p) {
      Remove-Item -Recurse -Force $p -ErrorAction SilentlyContinue
      Write-Host "REMOVED $p"
    }
  }
}

# --- Admin routes to remove (enterprise) ---
$adminRouteDir = "src/routes/_authenticated"
$removePrefixes = @(
  "admin.newsroom-ops",
  "admin.workflow",
  "admin.tips",
  "admin.editorial-calendar",
  "admin.stories",
  "admin.topics",
  "admin.epaper",
  "admin.videos",
  "admin.podcasts",
  "admin.infographics",
  "admin.social",
  "admin.comments",
  "admin.analytics",
  "admin.performance",
  "admin.security",
  "admin.backup",
  "admin.qa",
  "admin.homepage",
  "admin.smart-widgets",
  "admin.staff",
  "admin.authors",
  "admin.breaking-news",
  "admin.ambassadors",
  "admin.embassies",
  "admin.war-monitor",
  "admin.ticker",
  "admin.access",
  "admin.taxonomy",
  "admin.pages",
  "admin.menus",
  "admin.footer",
  "admin.articles.ai-",
  "admin.articles.internal-linking"
)

Get-ChildItem $adminRouteDir -Filter "admin*.tsx" | ForEach-Object {
  $name = $_.BaseName
  foreach ($prefix in $removePrefixes) {
    if ($name -eq $prefix -or $name.StartsWith($prefix + ".") -or $name.StartsWith($prefix)) {
      # careful: admin.articles should not match admin.articles.ai-
      if ($prefix -eq "admin.articles.ai-" -and $name.StartsWith("admin.articles.ai-")) {
        Remove-Item $_.FullName -Force
        Write-Host "REMOVED route $($_.Name)"
        return
      }
      if ($prefix -eq "admin.articles.internal-linking" -and $name -eq "admin.articles.internal-linking") {
        Remove-Item $_.FullName -Force
        Write-Host "REMOVED route $($_.Name)"
        return
      }
      if ($prefix -ne "admin.articles.ai-" -and $prefix -ne "admin.articles.internal-linking") {
        if ($name -eq $prefix -or $name.StartsWith("$prefix.")) {
          Remove-Item $_.FullName -Force
          Write-Host "REMOVED route $($_.Name)"
          return
        }
      }
    }
  }
}

# Explicit AI article routes
Remove-Paths @(
  "$adminRouteDir/admin.articles.ai-seo.tsx",
  "$adminRouteDir/admin.articles.ai-writing.tsx",
  "$adminRouteDir/admin.articles.internal-linking.tsx",
  "$adminRouteDir/admin.publishing.tsx"
)

# --- Component folders ---
Remove-Paths @(
  "src/components/breaking-news",
  "src/components/epaper",
  "src/components/videos",
  "src/components/podcasts",
  "src/components/infographics",
  "src/components/smart-widgets",
  "src/components/staff",
  "src/components/newsroom",
  "src/components/workflow",
  "src/components/tips",
  "src/components/stories",
  "src/components/topics",
  "src/components/social",
  "src/components/comments",
  "src/components/analytics",
  "src/components/homepage",
  "src/components/ambassadors",
  "src/components/embassies",
  "src/components/war-monitor",
  "src/components/editorial-calendar",
  "src/components/authors",
  "src/components/qa",
  "src/components/backup",
  "src/components/security",
  "src/components/performance",
  "src/components/admin/newsroom-ops-pages.tsx"
)

# --- Lib folders / files ---
Remove-Paths @(
  "src/lib/homepage",
  "src/lib/breaking-news",
  "src/lib/smart-widgets",
  "src/lib/newsroom",
  "src/lib/epaper.functions.ts",
  "src/lib/video.functions.ts",
  "src/lib/podcast.functions.ts",
  "src/lib/infographics.functions.ts",
  "src/lib/breaking-news.functions.ts",
  "src/lib/smart-widgets.functions.ts",
  "src/lib/newsroom-ops.functions.ts",
  "src/lib/stories.functions.ts",
  "src/lib/topics.functions.ts",
  "src/lib/social.functions.ts",
  "src/lib/comments.functions.ts",
  "src/lib/ambassadors.functions.ts",
  "src/lib/embassy.functions.ts",
  "src/lib/war-monitor.functions.ts",
  "src/lib/editorial-calendar.functions.ts",
  "src/lib/staff.functions.ts",
  "src/lib/analytics.functions.ts",
  "api/podcasts-rss.js"
)

Write-Host "PRUNE_DONE"
