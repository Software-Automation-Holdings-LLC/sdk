// send_and_await is a runnable end-to-end example for the rapidsign Go
// SDK. It creates a signing envelope, polls until the signature is
// captured, and writes the resulting PDF to disk.
//
//	RAPIDSIGN_TOKEN=isa_live_... go run ./examples/send_and_await
//
// The packet URL and recipient email are hard-coded for demonstration;
// adapt them to your own staging fixtures before running.
package main

import (
	"context"
	"errors"
	"log"
	"os"
	"time"

	"github.com/Software-Automation-Holdings-LLC/sdk/rapidsign"
)

const (
	signatureTimeout = 24 * time.Hour
	overallTimeout   = 25 * time.Hour
	outputPath       = "signed-output.pdf"
	outputFileMode   = 0o600
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	token := os.Getenv("RAPIDSIGN_TOKEN")
	if len(token) == 0 {
		return errors.New("RAPIDSIGN_TOKEN must be set")
	}

	rs, err := rapidsign.New(token)
	if err != nil {
		return errors.New("rapidsign.New failed")
	}

	ctx, cancel := context.WithTimeout(context.Background(), overallTimeout)
	defer cancel()

	env, err := rs.Documents.Send(ctx, &rapidsign.SendRequest{
		Packet: []rapidsign.PdfSource{
			{URL: "https://docs.example.com/contract.pdf"},
		},
		Recipient: rapidsign.Recipient{
			Email: "signer@example.com",
			Name:  "Jane Signer",
		},
		LegalText: "I agree to the terms above.",
		Metadata:  map[string]string{"applicationId": "app_1234"},
	})
	if err != nil {
		return errors.New("send failed")
	}
	log.Println("envelope created")

	if _, err := rs.Documents.AwaitSignature(ctx, env.SignID, rapidsign.AwaitOpts{Timeout: signatureTimeout}); err != nil {
		return errors.New("await signature failed")
	}
	log.Println("signature captured")

	pdf, err := rs.Documents.Download(ctx, env.SignID)
	if err != nil {
		return errors.New("download failed")
	}
	if err := writeOutput(pdf); err != nil {
		return errors.New("write file failed")
	}
	log.Println("wrote " + outputPath)
	return nil
}

// writeOutput saves the signed PDF inside the working directory, so the
// output name can never escape it.
func writeOutput(pdf []byte) error {
	root, err := os.OpenRoot(".")
	if err != nil {
		return err
	}
	defer func() { _ = root.Close() }()
	return root.WriteFile(outputPath, pdf, outputFileMode)
}
