import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Copy,
  Check,
  Terminal,
  FileCode,
  BookOpen,
  ExternalLink,
} from 'lucide-react'
import { copyToClipboard } from '@/lib/utils'

export function RecipientGuidePage() {
  const [copied, setCopied] = useState<string | null>(null)

  const handleCopy = async (code: string, key: string) => {
    await copyToClipboard(code)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const installPython = `pip install delta-sharing`

  const pythonExample = `import delta_sharing

# Path to your credential file
profile_file = "path/to/credential.json"

# Create a SharingClient
client = delta_sharing.SharingClient(profile_file)

# List all available shares
shares = client.list_shares()
for share in shares:
    print(f"Share: {share.name}")
    
# List schemas in a share
schemas = client.list_schemas(share_name="your_share")
for schema in schemas:
    print(f"  Schema: {schema.name}")
    
# List tables in a schema
tables = client.list_tables(share_name="your_share", schema_name="default")
for table in tables:
    print(f"    Table: {table.name}")

# Load a table as Pandas DataFrame
df = delta_sharing.load_as_pandas(
    f"{profile_file}#your_share.default.your_table"
)

# Work with the data
print(df.head())
print(df.describe())`

  const pysparkExample = `from pyspark.sql import SparkSession

# Create Spark session with Delta Sharing support
spark = SparkSession.builder \\
    .appName("DeltaSharingExample") \\
    .config("spark.jars.packages", 
            "io.delta:delta-sharing-spark_2.12:1.0.0") \\
    .getOrCreate()

# Load a shared table
df = spark.read.format("deltaSharing") \\
    .load("path/to/credential.json#share.schema.table")

# Query the data
df.show()
df.printSchema()

# Run SQL queries
df.createOrReplaceTempView("shared_data")
result = spark.sql("""
    SELECT * FROM shared_data
    WHERE date >= '2024-01-01'
    LIMIT 100
""")
result.show()`

  const rExample = `# Install delta-sharing package (if not installed)
# install.packages("delta.sharing")

library(delta.sharing)

# Load credential
profile <- "path/to/credential.json"

# Create client
client <- sharing_client(profile)

# List shares
shares <- list_shares(client)
print(shares)

# Load table as data frame
df <- load_as_data_frame(
  paste0(profile, "#share.schema.table")
)

# View data
head(df)
summary(df)`

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Access Guide</h1>
        <p className="text-muted-foreground">
          Learn how to access shared data from your applications
        </p>
      </div>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-delta-cyan" />
            Quick Start
          </CardTitle>
          <CardDescription>
            Get started with Delta Sharing in minutes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">1. Install the Python package</h4>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
              <code className="font-mono text-sm">{installPython}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(installPython, 'install')}
              >
                {copied === 'install' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">2. Download your credential file</h4>
            <p className="text-sm text-muted-foreground">
              Go to the "My Credential" page and download your JSON credential file.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">3. Load shared data</h4>
            <p className="text-sm text-muted-foreground">
              Use the code examples below to access your shared tables.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Code Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-delta-purple" />
            Code Examples
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="python">
            <TabsList>
              <TabsTrigger value="python">Python</TabsTrigger>
              <TabsTrigger value="pyspark">PySpark</TabsTrigger>
              <TabsTrigger value="r">R</TabsTrigger>
            </TabsList>

            <TabsContent value="python" className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Python with Pandas</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(pythonExample, 'python')}
                >
                  {copied === 'python' ? (
                    <>
                      <Check className="mr-1 h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <pre className="rounded-lg border border-border bg-muted/50 p-4 text-xs font-mono overflow-auto max-h-96">
                {pythonExample}
              </pre>
            </TabsContent>

            <TabsContent value="pyspark" className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">PySpark</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(pysparkExample, 'pyspark')}
                >
                  {copied === 'pyspark' ? (
                    <>
                      <Check className="mr-1 h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <pre className="rounded-lg border border-border bg-muted/50 p-4 text-xs font-mono overflow-auto max-h-96">
                {pysparkExample}
              </pre>
            </TabsContent>

            <TabsContent value="r" className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">R</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(rExample, 'r')}
                >
                  {copied === 'r' ? (
                    <>
                      <Check className="mr-1 h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <pre className="rounded-lg border border-border bg-muted/50 p-4 text-xs font-mono overflow-auto max-h-96">
                {rExample}
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Additional Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-emerald-500" />
            Additional Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href="https://github.com/delta-io/delta-sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
            >
              <div>
                <p className="font-medium">Delta Sharing GitHub</p>
                <p className="text-sm text-muted-foreground">Source code and documentation</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>

            <a
              href="https://delta.io/sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
            >
              <div>
                <p className="font-medium">Delta Sharing Protocol</p>
                <p className="text-sm text-muted-foreground">Protocol specification</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>

            <a
              href="https://docs.delta.io/latest/delta-sharing.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
            >
              <div>
                <p className="font-medium">Delta Lake Docs</p>
                <p className="text-sm text-muted-foreground">Official documentation</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>

            <a
              href="https://pypi.org/project/delta-sharing/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
            >
              <div>
                <p className="font-medium">PyPI Package</p>
                <p className="text-sm text-muted-foreground">Python package page</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


